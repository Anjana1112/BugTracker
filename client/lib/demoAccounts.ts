// Public demo logins created by the server's `npm run seed:demo`. Kept in
// sync by hand with server/src/lib/demoAccounts.ts.
export const DEMO_PASSWORD = "demo1234"

export const DEMO_ACCOUNTS = [
  { label: "Admin", name: "Maya Chen", email: "demo-admin@bugtracker.app" },
  {
    label: "Developer",
    name: "Daniel Okafor",
    email: "demo-developer@bugtracker.app",
  },
] as const
