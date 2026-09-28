# Bug Fix Report

Follow-up round of manual-testing issues found in the browser. Ground rules: diagnose before fixing, never weaken existing tests, run the full suite after each change, commit after each item is green.

## 1. Project creators can manage members

**Root cause:** `Project` had no record of who created it — `POST /projects/:projectId/members` and `DELETE /projects/:projectId/members/:userId` were gated by `requireAdmin` only, so a non-admin creator had no way to manage their own project's roster.

**Fix:**
- Added `Project.createdByUserId` (nullable `Int`, `onDelete: SetNull`) via migration `20260928003415_add_project_creator`. Applied to both the main and test databases.
  - Backfill: no historical record of the true creator exists, so existing projects were backfilled with the *lowest userId among their current team members* as a heuristic proxy (creators are always added as a member at creation time, and userIds are sequential) — a reasonable guess, not a verified fact.
- `POST /projects` now sets `createdByUserId` to the requester automatically.
- `addProjectMembers`/`removeProjectMembers` moved their permission check from the `requireAdmin` route middleware to an inline `isProjectCreatorOrAdmin` check in the controller, so the creator OR an admin can manage members. Admins keep bypassing project membership entirely, same as before (unchanged, confirmed by existing tests).
- The last-member guard on removal is unchanged.
- Client: `app/projects/[id]/page.tsx` and `projectUserColumns.tsx` now gate the "+ Add User" control and "Remove from project" action on `isAdmin || isCreator` instead of `isAdmin` alone.

**New tests** (`server/test/projects.test.ts`): creator (non-admin) can add a member (200); creator (non-admin) can remove a member (200); non-creator non-admin member gets 403 for both routes (existing tests renamed/updated to use an explicit, separate creator via a new `createdByUserId` factory override, rather than relying on an implicit default); `POST /projects` response asserts `createdByUserId` equals the requester.

**Commits:** `845e58d` (server), `2119e66` + `d65d5d4` (client, see item below on the client repo itself).

## 2. Attachment upload fails in the browser

Two independent bugs, both invisible to the server test suite because it mocks `S3Client` entirely.

**Bug A — dev server was using fake storage credentials.** `server/.env` had the `R2_*` keys defined twice: real values, then a second duplicate block of obviously-fake test values (`test-account-id`, `test-bucket`, etc.) appended after them with no separator. `dotenv` resolves duplicate keys within one file by taking the *last* occurrence, so the fake block silently won — confirmed by the presigned URL in your Network tab showing `test-account-id`/`test-access-key`. This predates this session (nothing in this work ever wrote to `.env`; migrations only ever touch `DATABASE_URL`). **You removed the duplicate block yourself** since it's a live-secrets file I shouldn't edit unilaterally.

**Bug B — presigned URL was signed with a checksum that could never match.** `@aws-sdk/client-s3` (v3.1137.0) defaults to adding a CRC32 flexible checksum to every request, including presigned `PutObject` URLs. That checksum gets computed against an *empty* body (presigning happens before any bytes exist), so R2 rejects the browser's real `PUT` — the reported "network connection was lost" / access-control failure, with `x-amz-checksum-crc32`/`x-amz-sdk-checksum-algorithm` visible in the signed URL's query string.

**Fix:** `server/src/lib/storage.ts`'s `S3Client` now sets `requestChecksumCalculation: "WHEN_REQUIRED"` and `responseChecksumValidation: "WHEN_REQUIRED"`, restoring the pre-default behavior (only checksum when a command explicitly asks for one).

**New test** (`server/test/comments.test.ts`): asserts the generated upload URL contains no `x-amz-checksum-*`/`x-amz-sdk-checksum-algorithm` params. Verified this test fails without the fix and passes with it.

**Also needed (outside the codebase):** the R2 bucket's CORS policy must allow the browser's cross-origin `PUT`:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```
Add the production origin to `AllowedOrigins` when deploying. This needs to be applied in the Cloudflare dashboard — not verified end-to-end in a real browser as part of this task, since that requires your R2 dashboard access.

**Commit:** `9f76602`.

## 3. Tickets list: default sort by most recently created

**Root cause:** `GET /tickets` had no `orderBy` at all (raw insertion/PK order). `GET /projects/:id/tickets` already had `orderBy: { createdAt: "desc" }` but was untested.

**Fix:** added `orderBy: { createdAt: "desc" }` to `getTickets`. Confirmed the client's `DataTable` has no default sort state (`sorting` initializes to `[]`), so `getSortedRowModel` preserves whatever order the server returns — no client change needed.

**New tests:** one for each endpoint, asserting the returned order matches explicitly-set `createdAt` timestamps.

**Commit:** `18600f7`.

## 4. Status change with multiple assignees

**Diagnosed, no bug found.** Wrote a test with two non-author, non-admin assignees on one ticket; each could independently change status via `PATCH /tickets/:id/status` (200/200). `updateTicketStatus`'s permission check (`ticketAssignments.some(a => a.userId === req.user!.userId)`) already iterates every assignee, not just the first, and both sides are numbers — no type mismatch. The client's `getTicketPermission` (`client/lib/ticketPermissions.ts`) does the same correct `.some()` check.

**Likely actual cause of what was observed:** the ticket detail/list pages only show the quick inline status dropdown for `permission === "status"` (a pure assignee — not the author, not an admin). An author or admin has `permission === "full"` and only gets an "Edit Ticket" button, with no quick status-only control, *regardless of how many assignees the ticket has*. On the ticket you were testing, you were the author (and thus "full"), which is why no dropdown appeared — unrelated to the second assignee.

**Open question (flagged, not implemented):** do you want the quick status dropdown to also show for "full" permission users, in addition to Edit/Delete? Not done pending your decision.

**New test:** `server/test/tickets.test.ts`, "lets each of two assignees change status."

**Commit:** `4d574bf`.

## 5. Page kept reloading

Investigated dashboardWrapper.tsx, NextAuth config, `api.ts`'s `request()` wrapper, and every page's `useEffect` usage — found no polling, no redirect loop, no `location.reload`/`router.refresh` calls, and no effect with unstable dependencies. You confirmed this was on a credentials-login account (ruling out the GitHub/no-backend-token theory) and reported the reloading has since stopped on its own. **Dropped per your instruction — no code changes made.**

## Client repository consolidation

Unrelated to the 5 bugs, but done per your explicit request: `client/` was a nested git repository (a nameless gitlink with no `.gitmodules`, one commit total — "feat: initial commit") embedded inside this repo, so the entire client app built on top of that commit was invisible to the parent repo's history, the same situation `server/` was in before its first checkpoint commit earlier in this project. Removed `client/.git`, flattened it into normal tracked files, and committed:
- Verified `client/.gitignore` already excludes `node_modules`, `.next/`, and `.env*.local` before staging; confirmed no `.env` file, secret, or ignored artifact ended up in either commit.
- `2119e66` — "Add client app" (everything except the 3 files below).
- `d65d5d4` — the 3 files touched for item 1 (`lib/api.ts`, `app/projects/[id]/page.tsx`, `app/projects/[id]/projectUserColumns.tsx`), as a separate commit.

## Open items requiring a decision

1. **Item 4:** should ticket authors/admins also get the quick inline status dropdown (not just pure assignees)?
2. **Item 2:** R2 bucket CORS policy still needs to be applied in the Cloudflare dashboard (config above) — not something fixable from this codebase.
3. **GitHub OAuth** is still not wired to a backend token (flagged in the previous round, explicitly deferred to a separate task this round — no change made).
