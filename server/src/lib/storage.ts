import { randomUUID } from "node:crypto";
import "dotenv/config";
import {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;
const publicUrlBase = process.env.R2_PUBLIC_URL_BASE;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrlBase) {
    throw new Error(
        "R2 storage environment variables are missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL_BASE)"
    );
}

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
});

const ATTACHMENT_PREFIX = "attachments";

// Keys are always server-generated, never derived from the client-supplied
// filename, so the extension comes from a fixed content-type lookup.
const EXTENSION_BY_MIME: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/csv": ".csv",
};

function keyFromUrl(url: string): string | null {
    if (!url.startsWith(`${publicUrlBase}/`)) {
        return null;
    }
    return url.slice(publicUrlBase!.length + 1);
}

// Ties an attachment URL to the ticket it was uploaded for, so a comment
// can't reference another ticket's (or another app's) storage object.
export function attachmentUrlBelongsToTicket(url: string, ticketId: number): boolean {
    const key = keyFromUrl(url);
    return key !== null && key.startsWith(`${ATTACHMENT_PREFIX}/${ticketId}/`);
}

export async function createUploadTarget(
    ticketId: number,
    contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
    const extension = EXTENSION_BY_MIME[contentType] ?? "";
    const key = `${ATTACHMENT_PREFIX}/${ticketId}/${randomUUID()}${extension}`;

    const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
        { expiresIn: 300 }
    );

    return { uploadUrl, publicUrl: `${publicUrlBase}/${key}` };
}

// Re-checks the actual stored object (not just what the client declared
// before uploading) so a tampered upload can't slip past the size/type limit.
export async function verifyUploadedObject(
    url: string
): Promise<{ size: number; contentType: string }> {
    const key = keyFromUrl(url);
    if (!key) {
        throw new Error("Attachment URL is not a recognized storage object");
    }

    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
}

// Best-effort: logs and swallows failures rather than blocking the caller,
// since a DB write shouldn't fail because a storage cleanup call failed.
export async function deleteAttachment(url: string): Promise<void> {
    const key = keyFromUrl(url);
    if (!key) {
        return;
    }

    try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
        console.error(`Failed to delete attachment at ${url}:`, err);
    }
}
