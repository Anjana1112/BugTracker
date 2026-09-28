-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "createdByUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (heuristic, no historical record of the true creator exists):
-- use the lowest userId among each project's current team members as a
-- proxy for "earliest/original member" — POST /projects always adds the
-- creator as a member at creation time, and userId is an autoincrement, so
-- for most existing projects this is a reasonable guess, not a verified
-- fact. Projects with no team members (shouldn't exist, but just in case)
-- are left NULL.
UPDATE "Project" p
SET "createdByUserId" = sub.min_user_id
FROM (
    SELECT "A" AS project_id, MIN("B") AS min_user_id
    FROM "_ProjectMembers"
    GROUP BY "A"
) sub
WHERE p."projectId" = sub.project_id
AND p."createdByUserId" IS NULL;
