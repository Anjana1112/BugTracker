import jwt from "jsonwebtoken";

type AuthUser = {
    userId: number;
    username: string;
    email: string;
    role: string;
};

// Mirrors exactly what authController.ts's real /api/login signs — same
// payload shape requireAuth expects on req.user.
export function signToken(user: AuthUser): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is missing");
    return jwt.sign(
        {
            userId: user.userId,
            username: user.username,
            email: user.email,
            role: user.role,
        },
        secret,
        { expiresIn: "1h" }
    );
}

export function authHeader(user: AuthUser): { Authorization: string } {
    return { Authorization: `Bearer ${signToken(user)}` };
}
