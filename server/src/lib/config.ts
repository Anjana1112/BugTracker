// Bcrypt cost factor. Configurable via env so the test suite can run with a
// low (fast) cost without changing production's behavior — defaults to 10
// (the value hardcoded here before) whenever BCRYPT_COST isn't set.
export const BCRYPT_COST = Number(process.env.BCRYPT_COST) || 10;
