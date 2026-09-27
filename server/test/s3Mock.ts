import { mockClient } from "aws-sdk-client-mock";
import {
    S3Client,
    HeadObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Patches S3Client.prototype.send globally — this intercepts every
// S3Client instance in the process, including the one storage.ts
// constructs at module scope, so no test ever reaches real Cloudflare R2.
export const s3Mock = mockClient(S3Client);

// A permissive default: any HeadObjectCommand resolves as a valid,
// in-limits image/png object. Individual tests override this per-call
// (e.g. to simulate a missing object, or an oversized/wrong-type one).
export function resetS3Mock(): void {
    s3Mock.reset();
    s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 1024,
        ContentType: "image/png",
    });
    s3Mock.on(DeleteObjectCommand).resolves({});
}
