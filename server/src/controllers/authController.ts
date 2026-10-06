import type { Request, Response } from "express";
import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import type { User } from "../generated/prisma/client.js";
import { BCRYPT_COST } from "../lib/config.js";
import { isReservedDemoEmail } from "../lib/demoAccounts.js";
import { handleControllerError } from "../lib/errorHandler.js";
import { ValidationError, assertMinLength, requireNonEmptyString } from "../lib/validation.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Same JWT payload requireAuth expects on req.user, plus the user row
// minus its password hash. Shared by login and register.
function buildAuthResponse(user: User) {
    const token = jwt.sign(
        {
            userId: user.userId,
            username: user.username,
            email: user.email,
            role: user.role,
        },
        jwtSecret as string,
        { expiresIn: "7d" }
    );

    const { password: _password, ...safeUser } = user;
    return { token, user: safeUser };
}

// POST /api/login
export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
        res.status(400).json({ message: "email and password are required" });
        return;
    }

    try {
        // Emails are normalized to lowercase/trimmed on every write, so a
        // plain equality lookup on the same normalization is case-insensitive.
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        // deletedAt is the authoritative "deactivated" marker (see
        // requireAuth) — checked explicitly here rather than relying on the
        // coincidence that deleteMyAccount also nulls the password.
        if (!user || !user.password || user.deletedAt) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        res.json(buildAuthResponse(user));
    } catch (err: any) {
        res.status(500).json({ message: `error logging in: ${err.message}` });
    }
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes; the cap also stops huge payloads
// from being hashed.
const MAX_PASSWORD_LENGTH = 128;
const MAX_USERNAME_LENGTH = 50;

// POST /api/register
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, email, password } = (req.body ?? {}) as {
            username?: unknown;
            email?: unknown;
            password?: unknown;
        };

        const trimmedUsername = requireNonEmptyString(username, "username").trim();
        if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
            throw new ValidationError(`username must be at most ${MAX_USERNAME_LENGTH} characters`);
        }

        const normalizedEmail = requireNonEmptyString(email, "email").trim().toLowerCase();
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            throw new ValidationError("email must be a valid email address");
        }
        if (isReservedDemoEmail(normalizedEmail)) {
            throw new ValidationError("This email domain is reserved for demo accounts");
        }

        if (typeof password !== "string" || password.length === 0) {
            throw new ValidationError("password is required");
        }
        assertMinLength(password, MIN_PASSWORD_LENGTH, "Password");
        if (password.length > MAX_PASSWORD_LENGTH) {
            throw new ValidationError(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
        }

        const existing = await prisma.user.findFirst({
            where: { OR: [{ email: normalizedEmail }, { username: trimmedUsername }] },
            select: { email: true },
        });
        if (existing) {
            const message =
                existing.email === normalizedEmail
                    ? "An account with this email already exists"
                    : "That username is already taken";
            res.status(409).json({ message });
            return;
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

        // role is never read from the request body — every self-registered
        // account starts with the lowest-privilege role. cognitoId is a
        // legacy required/unique column with no meaning for local accounts.
        const user = await prisma.user.create({
            data: {
                cognitoId: `local-${randomUUID()}`,
                username: trimmedUsername,
                email: normalizedEmail,
                password: passwordHash,
                role: "DEVELOPER",
            },
        });

        res.status(201).json(buildAuthResponse(user));
    } catch (err: any) {
        // A concurrent duplicate that slips past the check above surfaces as
        // a P2002 unique violation, which handleControllerError maps to 409.
        handleControllerError(err, res, "error registering");
    }
};
