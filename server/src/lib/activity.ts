export type FieldDiff = { field: string; oldValue: string | null; newValue: string | null };

function stringifyValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

// Compares `before`/`after` on the given fields, returning one entry per
// field whose stringified value actually changed. `after` is often a
// constructed object of just-validated values, not the same shape as
// `before` (a full Prisma row) — hence the loose Record typing here.
export function diffFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fields: string[]
): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    for (const field of fields) {
        const oldValue = stringifyValue(before[field]);
        const newValue = stringifyValue(after[field]);
        if (oldValue !== newValue) {
            diffs.push({ field, oldValue, newValue });
        }
    }
    return diffs;
}

export function diffIdSets(
    before: number[],
    after: number[]
): { added: number[]; removed: number[] } {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    return {
        added: after.filter((id) => !beforeSet.has(id)),
        removed: before.filter((id) => !afterSet.has(id)),
    };
}

export type ActivityCreateInput = {
    action: "FIELD_CHANGED" | "ASSIGNEE_ADDED" | "ASSIGNEE_REMOVED" | "MEMBER_ADDED" | "MEMBER_REMOVED";
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    actorUserId: number;
    ticketId?: number;
    projectId?: number;
};

export function buildAssigneeActivityInputs(
    before: number[],
    after: number[],
    actorUserId: number,
    ticketId: number
): ActivityCreateInput[] {
    const { added, removed } = diffIdSets(before, after);
    return [
        ...added.map(
            (userId): ActivityCreateInput => ({
                action: "ASSIGNEE_ADDED",
                newValue: String(userId),
                actorUserId,
                ticketId,
            })
        ),
        ...removed.map(
            (userId): ActivityCreateInput => ({
                action: "ASSIGNEE_REMOVED",
                oldValue: String(userId),
                actorUserId,
                ticketId,
            })
        ),
    ];
}

export function buildMemberActivityInputs(
    before: number[],
    after: number[],
    actorUserId: number,
    projectId: number
): ActivityCreateInput[] {
    const { added, removed } = diffIdSets(before, after);
    return [
        ...added.map(
            (userId): ActivityCreateInput => ({
                action: "MEMBER_ADDED",
                newValue: String(userId),
                actorUserId,
                projectId,
            })
        ),
        ...removed.map(
            (userId): ActivityCreateInput => ({
                action: "MEMBER_REMOVED",
                oldValue: String(userId),
                actorUserId,
                projectId,
            })
        ),
    ];
}
