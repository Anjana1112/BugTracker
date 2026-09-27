import bcrypt from "bcryptjs";
import { prisma } from "./setup.js";
import { BCRYPT_COST } from "../src/lib/config.js";

let counter = 0;
function unique(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
}

export async function createUser(
    overrides: Partial<{
        username: string;
        email: string;
        password: string | null;
        role: "ADMIN" | "DEVELOPER";
        profilePictureUrl: string | null;
    }> = {}
) {
    const tag = unique("user");
    const plainPassword = overrides.password === undefined ? "password123" : overrides.password;

    const user = await prisma.user.create({
        data: {
            cognitoId: unique("cognito"),
            username: overrides.username ?? tag,
            email: overrides.email ?? `${tag}@example.com`,
            password: plainPassword ? bcrypt.hashSync(plainPassword, BCRYPT_COST) : null,
            role: overrides.role ?? "DEVELOPER",
            profilePictureUrl: overrides.profilePictureUrl ?? null,
        },
    });

    // Not a real column — attached for tests that need to log in as this
    // user (the real `password` field only ever holds the bcrypt hash).
    return { ...user, plainPassword };
}

export async function createProject(
    overrides: Partial<{
        name: string;
        description: string | null;
        startDate: Date | null;
        endDate: Date | null;
    }> = {},
    memberIds: number[] = []
) {
    const tag = unique("project");
    return prisma.project.create({
        data: {
            name: overrides.name ?? tag,
            description: overrides.description ?? null,
            startDate: overrides.startDate ?? null,
            endDate: overrides.endDate ?? null,
            ...(memberIds.length > 0 && {
                teamMembers: { connect: memberIds.map((userId) => ({ userId })) },
            }),
        },
        include: { teamMembers: true },
    });
}

export async function createTicket(overrides: {
    projectId: number;
    authorUserId: number;
    title?: string;
    description?: string | null;
    status?: "OPEN" | "IN_PROGRESS" | "CLOSED";
    priority?: "LOW" | "MEDIUM" | "HIGH";
    type?: "BUG" | "FEATURE" | "TASK";
    startDate?: Date | null;
    dueDate?: Date | null;
    assigneeIds?: number[];
}) {
    const tag = unique("ticket");
    return prisma.ticket.create({
        data: {
            title: overrides.title ?? tag,
            description: overrides.description ?? null,
            status: overrides.status ?? "OPEN",
            priority: overrides.priority ?? "LOW",
            type: overrides.type ?? "BUG",
            startDate: overrides.startDate ?? null,
            dueDate: overrides.dueDate ?? null,
            projectId: overrides.projectId,
            authorUserId: overrides.authorUserId,
            ...(overrides.assigneeIds &&
                overrides.assigneeIds.length > 0 && {
                    ticketAssignments: {
                        create: overrides.assigneeIds.map((userId) => ({ userId })),
                    },
                }),
        },
        include: { ticketAssignments: true },
    });
}

export async function createComment(overrides: {
    ticketId: number;
    userId: number;
    text?: string;
}) {
    return prisma.comment.create({
        data: {
            text: overrides.text ?? unique("comment"),
            ticketId: overrides.ticketId,
            userId: overrides.userId,
        },
    });
}
