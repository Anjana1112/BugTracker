import type { Request, Response, NextFunction } from "express";
import { isDemoAccountEmail } from "../lib/demoAccounts.js";

export const DEMO_MODE_MESSAGE = "Disabled in demo mode.";

// The demo logins' password is public, so anything that could lock people
// out or destroy accounts is refused for them. Identified by the signed JWT's
// email claim — demo accounts can't change their email (see editUser), so the
// claim stays accurate.
export function isDemoUser(req: Request): boolean {
    return req.user !== undefined && isDemoAccountEmail(req.user.email);
}

// Route-level guard for endpoints demo accounts may not use at all.
// Mount after requireAuth (which sets req.user).
export function blockDemoAccounts(req: Request, res: Response, next: NextFunction): void {
    if (isDemoUser(req)) {
        res.status(403).json({ message: DEMO_MODE_MESSAGE });
        return;
    }
    next();
}
