-- Data migration (no schema change): the deletedAt column was added after
-- deleteMyAccount already existed, so any account it anonymized before this
-- migration has deletedAt still null. Backfill it using updatedAt (the
-- timestamp the anonymizing UPDATE itself set) as the best available
-- approximation of the actual deletion time.
UPDATE "User"
SET "deletedAt" = "updatedAt"
WHERE "username" LIKE 'deleted-user-%' AND "deletedAt" IS NULL;
