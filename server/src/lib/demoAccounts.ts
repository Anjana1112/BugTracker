import type { Role } from "../generated/prisma/enums.js";

// Public demo logins created by prisma/demo-seed.ts — one per Role. The
// password is intentionally public (shown on the client's sign-in page).
// Kept in sync by hand with client/lib/demoAccounts.ts.
export const DEMO_PASSWORD = "demo1234";

// Every demo/sample account lives on this domain, and /api/register refuses
// it, so nobody can claim a demo address before the demo seed runs.
export const DEMO_EMAIL_DOMAIN = "bugtracker.app";

export const DEMO_ACCOUNTS = {
    ADMIN: { email: `demo-admin@${DEMO_EMAIL_DOMAIN}`, username: "MayaChen" },
    DEVELOPER: { email: `demo-developer@${DEMO_EMAIL_DOMAIN}`, username: "DanielOkafor" },
} as const satisfies Record<Role, { email: string; username: string }>;

export function isReservedDemoEmail(normalizedEmail: string): boolean {
    return normalizedEmail.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

const DEMO_LOGIN_EMAILS: ReadonlySet<string> = new Set(
    Object.values(DEMO_ACCOUNTS).map((account) => account.email)
);

// True only for the public demo logins themselves (not every address on the
// demo domain — the seeded teammates have no password and can't sign in).
export function isDemoAccountEmail(email: string): boolean {
    return DEMO_LOGIN_EMAILS.has(email.trim().toLowerCase());
}
