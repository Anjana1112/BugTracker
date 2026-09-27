-- CreateTable
CREATE TABLE "CommentAttachment" (
    "attachmentId" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentAttachment_pkey" PRIMARY KEY ("attachmentId")
);

-- CreateIndex
CREATE INDEX "CommentAttachment_commentId_idx" ON "CommentAttachment"("commentId");

-- AddForeignKey
ALTER TABLE "CommentAttachment" ADD CONSTRAINT "CommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("commentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: carry forward existing attachmentURLs entries as
-- CommentAttachment rows before the column is dropped. These are all
-- pre-existing seed placeholders (bare filenames like "i1.jpg", never
-- real uploaded objects), so mimeType is guessed from the file extension
-- and size is left NULL since no real byte count exists for them.
INSERT INTO "CommentAttachment" ("commentId", "url", "originalFilename", "mimeType", "size", "createdAt")
SELECT
    c."commentId",
    u.url,
    u.url,
    CASE
        WHEN u.url ILIKE '%.jpg' OR u.url ILIKE '%.jpeg' THEN 'image/jpeg'
        WHEN u.url ILIKE '%.png' THEN 'image/png'
        WHEN u.url ILIKE '%.gif' THEN 'image/gif'
        WHEN u.url ILIKE '%.webp' THEN 'image/webp'
        WHEN u.url ILIKE '%.pdf' THEN 'application/pdf'
        WHEN u.url ILIKE '%.csv' THEN 'text/csv'
        WHEN u.url ILIKE '%.txt' THEN 'text/plain'
        ELSE 'application/octet-stream'
    END,
    NULL,
    c."createdAt"
FROM "Comment" c, unnest(c."attachmentURLs") AS u(url)
WHERE c."attachmentURLs" IS NOT NULL AND array_length(c."attachmentURLs", 1) > 0;

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "attachmentURLs";
