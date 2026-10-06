import { rateLimit } from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Per-IP limiter for unauthenticated credential endpoints (/api/login,
// /api/register). In-memory store: counts reset when the process restarts
// and aren't shared across instances — fine for a single Render instance.
// AUTH_RATE_LIMIT_MAX overrides the default (the test suite raises it so
// unrelated tests don't trip the limit).
export function createAuthRateLimiter(options: { limit?: number; windowMs?: number } = {}) {
    return rateLimit({
        windowMs: options.windowMs ?? FIFTEEN_MINUTES,
        limit: options.limit ?? (Number(process.env.AUTH_RATE_LIMIT_MAX) || 10),
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { message: "Too many attempts. Please wait a few minutes and try again." },
    });
}
