// Mirrors the enums in prisma/schema.prisma. The generated Prisma client
// doesn't cleanly re-export these for import, so they're hardcoded here —
// same as the client already does in lib/api.ts.
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const TICKET_TYPES = ["BUG", "FEATURE", "TASK"] as const;

export class ValidationError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = "ValidationError";
        this.status = status;
    }
}

export function requireNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new ValidationError(`${fieldName} is required`);
    }
    return value;
}

export function validateEnumValue<T extends string>(
    value: unknown,
    allowed: readonly T[],
    fieldName: string
): T {
    if (typeof value !== "string" || !allowed.includes(value as T)) {
        throw new ValidationError(`${fieldName} must be one of: ${allowed.join(", ")}`);
    }
    return value as T;
}

// Returns null for missing/empty input (the field is optional), throws if
// non-empty input can't be parsed as a date.
export function parseOptionalDate(value: unknown, fieldName: string): Date | null {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) {
        throw new ValidationError(`${fieldName} is not a valid date`);
    }
    return date;
}

export function datesEqual(a: Date | null, b: Date | null): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a.getTime() === b.getTime();
}

export function assertProjectDateOrder(startDate: Date | null, endDate: Date | null): void {
    if (startDate && endDate && endDate < startDate) {
        throw new ValidationError("Project end date cannot be before the start date");
    }
}

// Each check is independently skipped when the relevant side is null
// (both Project.startDate/endDate and Ticket.startDate/dueDate are
// nullable in the schema). Fails on the first violated rule.
export function assertTicketDates(
    ticketStartDate: Date | null,
    ticketDueDate: Date | null,
    projectStartDate: Date | null,
    projectEndDate: Date | null
): void {
    if (ticketStartDate && projectStartDate && ticketStartDate < projectStartDate) {
        throw new ValidationError("Ticket start date cannot be before the project's start date");
    }
    if (ticketDueDate && projectStartDate && ticketDueDate < projectStartDate) {
        throw new ValidationError("Ticket due date cannot be before the project's start date");
    }
    if (ticketDueDate && projectEndDate && ticketDueDate > projectEndDate) {
        throw new ValidationError("Ticket due date cannot be after the project's end date");
    }
    if (ticketStartDate && ticketDueDate && ticketDueDate < ticketStartDate) {
        throw new ValidationError("Ticket due date cannot be before the ticket's own start date");
    }
}

export function assertUsersExist(requestedIds: number[], existingIds: Set<number>): void {
    const missing = requestedIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
        throw new ValidationError(`User(s) ${missing.join(", ")} do not exist`);
    }
}

export function assertAssigneesAreProjectMembers(
    assigneeIds: number[],
    memberIds: Set<number>
): void {
    const invalid = assigneeIds.filter((id) => !memberIds.has(id));
    if (invalid.length > 0) {
        throw new ValidationError(
            `User(s) ${invalid.join(", ")} are not members of this project`
        );
    }
}

export function assertNotLastProjectMember(memberCount: number): void {
    if (memberCount <= 1) {
        throw new ValidationError("Cannot remove the last remaining member of a project", 403);
    }
}

export function assertMinLength(value: string, min: number, fieldName: string): void {
    if (value.length < min) {
        throw new ValidationError(`${fieldName} must be at least ${min} characters`);
    }
}

export const ATTACHMENT_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
] as const;

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB, mirrors the client's MAX_FILE_SIZE

// Validated at upload-url request time (declared metadata) and again after
// upload completes (actual stored metadata) — see storage.ts.
export function assertAttachmentMeta(
    contentType: unknown,
    contentLength: unknown
): { contentType: string; contentLength: number } {
    if (
        typeof contentType !== "string" ||
        !ATTACHMENT_MIME_TYPES.includes(contentType as (typeof ATTACHMENT_MIME_TYPES)[number])
    ) {
        throw new ValidationError(
            `Attachment type must be one of: ${ATTACHMENT_MIME_TYPES.join(", ")}`
        );
    }

    const size = Number(contentLength);
    if (!Number.isFinite(size) || size <= 0) {
        throw new ValidationError("Attachment size is invalid");
    }
    if (size > MAX_ATTACHMENT_SIZE) {
        throw new ValidationError(
            `Attachment exceeds the ${MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB size limit`
        );
    }

    return { contentType, contentLength: size };
}
