-- Data migration (no schema change): emails are now normalized to
-- lowercase/trimmed on every write (signup, PATCH /users/:id) and on login
-- lookup, so existing rows must be normalized too or they'd silently stop
-- matching. Verified beforehand that no two existing emails collide after
-- this normalization (see the pre-migration collision check).
UPDATE "User"
SET "email" = lower(trim("email"))
WHERE "email" != lower(trim("email"));
