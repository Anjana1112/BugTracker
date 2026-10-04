import type { Request, Response } from "express";
import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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

        const token = jwt.sign(
            {
                userId: user.userId,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            jwtSecret,
            { expiresIn: "7d" }
        );

        const { password: _password, ...safeUser } = user;

        res.json({ token, user: safeUser });
    } catch (err: any) {
        res.status(500).json({ message: `error logging in: ${err.message}` });
    }
};
