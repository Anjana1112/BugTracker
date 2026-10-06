// Demo accounts + sample content for the public deployment.
//
// SAFE TO RUN AGAINST PRODUCTION. Unlike seed.ts, this never deletes
// anything: users are upserted by email, and projects/tickets are created
// only if one with the same name (project) or title-within-project (ticket)
// doesn't already exist. Re-running it is a no-op apart from resetting the
// demo logins (password, role, deactivation) and re-adding them to the demo
// projects — handy if a visitor changed the public demo password.
//
// Run: npm run seed:demo  (uses DATABASE_URL from the environment / .env)
import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { Role, TicketPriority, TicketStatus, TicketType } from "../src/generated/prisma/enums.js";
import { BCRYPT_COST } from "../src/lib/config.js";
import { DEMO_ACCOUNTS, DEMO_EMAIL_DOMAIN, DEMO_PASSWORD } from "../src/lib/demoAccounts.js";

// --- Dates, relative to when the seed runs so the data always looks fresh --

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
// Fixed times of day so timestamps don't all share the seed's exact clock time.
function daysAgo(days: number, hour = 10, minute = 0): Date {
    const d = new Date(now - days * DAY);
    d.setHours(hour, minute, 0, 0);
    return d;
}
function daysFromNow(days: number): Date {
    return daysAgo(-days, 17, 0);
}

// --- People -------------------------------------------------------------

type PersonKey = "maya" | "daniel" | "priya" | "lucas" | "sofia" | "james";

// maya/daniel are the public demo logins (one per Role). The rest are
// teammates that make the data look lived-in; they have no password, so
// nobody can sign in as them.
const TEAMMATES: Record<Exclude<PersonKey, "maya" | "daniel">, { username: string; email: string }> = {
    priya: { username: "PriyaRaman", email: `priya.raman@${DEMO_EMAIL_DOMAIN}` },
    lucas: { username: "LucasMoreau", email: `lucas.moreau@${DEMO_EMAIL_DOMAIN}` },
    sofia: { username: "SofiaHernandez", email: `sofia.hernandez@${DEMO_EMAIL_DOMAIN}` },
    james: { username: "JamesWhitfield", email: `james.whitfield@${DEMO_EMAIL_DOMAIN}` },
};

const DEMO_LOGIN_PEOPLE: Record<"maya" | "daniel", Role> = {
    maya: "ADMIN",
    daniel: "DEVELOPER",
};

// --- Content --------------------------------------------------------------

type ProjectKey = "checkout" | "mobile" | "platform" | "support";

type ProjectSpec = {
    name: string;
    description: string;
    startDate: Date;
    endDate: Date | null;
    members: PersonKey[];
};

const PROJECTS: Record<ProjectKey, ProjectSpec> = {
    checkout: {
        name: "Checkout Revamp",
        description:
            "Rebuilding the web checkout as a single page: saved payment methods, address autocomplete, and clearer error states. Goal is to cut cart abandonment by 15% before the holiday code freeze.",
        startDate: daysAgo(42),
        endDate: daysFromNow(30),
        members: ["maya", "daniel", "priya", "lucas"],
    },
    mobile: {
        name: "Mobile App 2.4",
        description:
            "iOS and Android release adding offline access to saved lists, granular push notification settings, and the crash fixes reported after the 2.3 rollout.",
        startDate: daysAgo(35),
        endDate: daysFromNow(21),
        members: ["maya", "daniel", "sofia", "james"],
    },
    platform: {
        name: "Platform Reliability",
        description:
            "Ongoing infrastructure work: tuning noisy alerts, the Postgres 16 upgrade, and getting p95 API latency under 300ms.",
        startDate: daysAgo(60),
        endDate: null,
        members: ["maya", "daniel", "lucas", "james"],
    },
    support: {
        name: "Customer Support Portal",
        description:
            "Self-serve help center and ticket intake for enterprise customers, with Zendesk sync so support agents keep a single queue.",
        startDate: daysAgo(20),
        endDate: daysFromNow(45),
        members: ["maya", "sofia", "priya", "daniel"],
    },
};

type CommentSpec = { by: PersonKey; text: string; daysAgo: number };

type TicketSpec = {
    project: ProjectKey;
    title: string;
    description: string;
    type: TicketType;
    status: TicketStatus;
    priority: TicketPriority;
    author: PersonKey;
    assignees: PersonKey[];
    createdDaysAgo: number;
    // Relative to now; negative = already past due.
    dueInDays?: number;
    // Recorded as a FIELD_CHANGED priority activity (from -> current priority).
    escalatedFrom?: TicketPriority;
    comments?: CommentSpec[];
};

const TICKETS: TicketSpec[] = [
    // --- Checkout Revamp ---
    {
        project: "checkout",
        title: "Payment fails silently when card requires 3-D Secure",
        description:
            "Cards that trigger a 3DS challenge return to checkout with no error and no order. Reproducible with Stripe test card 4000 0027 6000 3184. Looks like we drop the `requires_action` status instead of opening the challenge modal.",
        type: "BUG",
        status: "IN_PROGRESS",
        priority: "HIGH",
        author: "priya",
        assignees: ["daniel"],
        createdDaysAgo: 9,
        dueInDays: 2,
        escalatedFrom: "MEDIUM",
        comments: [
            { by: "daniel", text: "Confirmed — we only handle `succeeded` and `requires_payment_method`. Adding the `handleNextAction` flow now.", daysAgo: 8 },
            { by: "maya", text: "Bumping to high. Support says a handful of EU customers hit this every day.", daysAgo: 8 },
            { by: "daniel", text: "Fix is up for review. Covered the challenge-cancelled path too.", daysAgo: 1 },
        ],
    },
    {
        project: "checkout",
        title: "Add address autocomplete to shipping form",
        description:
            "Use the Places API to suggest addresses as the user types. Must still allow manual entry, and must not block the form if the API is slow or unavailable.",
        type: "FEATURE",
        status: "CLOSED",
        priority: "MEDIUM",
        author: "maya",
        assignees: ["lucas"],
        createdDaysAgo: 30,
        dueInDays: -10,
        comments: [
            { by: "lucas", text: "Shipped behind the `address_autocomplete` flag. Falls back to the plain form after 800ms without a response.", daysAgo: 14 },
            { by: "priya", text: "QA passed on Chrome, Safari and Firefox. Nice work.", daysAgo: 12 },
        ],
    },
    {
        project: "checkout",
        title: "Saved payment methods: list, set default, remove",
        description:
            "Returning customers should see their saved cards on the payment step, pick a default, and remove old ones. Cards are stored in Stripe; we only keep the PaymentMethod id.",
        type: "FEATURE",
        status: "IN_PROGRESS",
        priority: "HIGH",
        author: "maya",
        assignees: ["lucas", "daniel"],
        createdDaysAgo: 21,
        dueInDays: 12,
        comments: [
            { by: "lucas", text: "Listing and removal are done. Setting a default needs a small schema change. Will open a separate PR.", daysAgo: 4 },
        ],
    },
    {
        project: "checkout",
        title: "Order summary total doesn't update after promo code removal",
        description:
            "Apply a promo code, then remove it. The line items update but the total still shows the discount until the page is refreshed.",
        type: "BUG",
        status: "OPEN",
        priority: "MEDIUM",
        author: "priya",
        assignees: ["daniel"],
        createdDaysAgo: 3,
        dueInDays: 10,
    },
    {
        project: "checkout",
        title: "Track checkout funnel events in analytics",
        description:
            "Emit `checkout_step_viewed` and `checkout_step_completed` for each step, so we can measure the abandonment drop the project is targeting.",
        type: "TASK",
        status: "OPEN",
        priority: "LOW",
        author: "maya",
        assignees: [],
        createdDaysAgo: 12,
        dueInDays: 25,
    },
    {
        project: "checkout",
        title: "Inline validation errors are not announced to screen readers",
        description:
            "Field errors appear visually but aren't linked with `aria-describedby`, and the live region never fires. Flagged in the accessibility audit.",
        type: "BUG",
        status: "CLOSED",
        priority: "MEDIUM",
        author: "priya",
        assignees: ["priya"],
        createdDaysAgo: 26,
        dueInDays: -15,
        comments: [
            { by: "priya", text: "Fixed and verified with VoiceOver and NVDA.", daysAgo: 18 },
        ],
    },
    {
        project: "checkout",
        title: "Load test the new checkout API at 3x peak traffic",
        description:
            "Use the k6 scenarios from last year's Black Friday prep. We need p95 under 400ms at 3x last November's peak before we ramp past 50%.",
        type: "TASK",
        status: "OPEN",
        priority: "HIGH",
        author: "maya",
        assignees: ["lucas"],
        createdDaysAgo: 5,
        dueInDays: 14,
    },

    // --- Mobile App 2.4 ---
    {
        project: "mobile",
        title: "Crash on launch for Android 14 devices with work profiles",
        description:
            "Top crash in 2.3.1 (Crashlytics: ~1.8% of Android 14 sessions). `SecurityException` reading contacts when the app runs inside a managed work profile.",
        type: "BUG",
        status: "CLOSED",
        priority: "HIGH",
        author: "james",
        assignees: ["sofia"],
        createdDaysAgo: 33,
        dueInDays: -25,
        comments: [
            { by: "sofia", text: "Contact sync now asks for permission lazily and handles the exception. Hotfix 2.3.2 is out.", daysAgo: 29 },
            { by: "james", text: "Crash-free sessions back to 99.7%. Closing.", daysAgo: 27 },
        ],
    },
    {
        project: "mobile",
        title: "Offline mode for saved lists",
        description:
            "Cache saved lists locally (SQLite on Android, Core Data on iOS) and queue edits made offline. Sync on reconnect, server wins on conflicts.",
        type: "FEATURE",
        status: "IN_PROGRESS",
        priority: "HIGH",
        author: "maya",
        assignees: ["sofia", "james"],
        createdDaysAgo: 28,
        dueInDays: 9,
        comments: [
            { by: "james", text: "iOS is caching reads. Edit queueing is next.", daysAgo: 10 },
            { by: "sofia", text: "Android has reads and queued edits. Still need conflict handling for deleted lists.", daysAgo: 6 },
            { by: "maya", text: "For 2.4, server-wins on a deleted list is fine. Just show a toast so people know what happened.", daysAgo: 5 },
        ],
    },
    {
        project: "mobile",
        title: "Notification settings screen",
        description:
            "Let users toggle each push category (order updates, price drops, recommendations) on its own instead of all at once.",
        type: "FEATURE",
        status: "OPEN",
        priority: "MEDIUM",
        author: "maya",
        assignees: ["daniel"],
        createdDaysAgo: 15,
        dueInDays: 16,
    },
    {
        project: "mobile",
        title: "Images flicker when scrolling long lists on iOS",
        description:
            "Thumbnails reload when cells are reused, which causes a visible flicker on older iPhones. Probably a missing cache key on the image loader.",
        type: "BUG",
        status: "OPEN",
        priority: "LOW",
        author: "daniel",
        assignees: ["james"],
        createdDaysAgo: 7,
        dueInDays: 18,
    },
    {
        project: "mobile",
        title: "Update App Store screenshots and release notes for 2.4",
        description: "New screenshots for offline mode and notification settings, in all 6 supported locales.",
        type: "TASK",
        status: "OPEN",
        priority: "LOW",
        author: "sofia",
        assignees: [],
        createdDaysAgo: 4,
        dueInDays: 19,
    },
    {
        project: "mobile",
        title: "Deep links from emails open the home screen instead of the product",
        description:
            "Universal links from marketing emails lose the path when the app is cold-started. Works fine when the app is already running in the background.",
        type: "BUG",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        author: "james",
        assignees: ["daniel"],
        createdDaysAgo: 11,
        dueInDays: 5,
        comments: [
            { by: "daniel", text: "We read the link before navigation has mounted on a cold start. Holding it until the root navigator is ready fixes it locally.", daysAgo: 3 },
        ],
    },

    // --- Platform Reliability ---
    {
        project: "platform",
        title: "Upgrade production Postgres from 14 to 16",
        description:
            "Use logical replication to a new 16 cluster and keep the cutover window under 5 minutes. Rehearse it on staging first with a production-sized snapshot.",
        type: "TASK",
        status: "IN_PROGRESS",
        priority: "HIGH",
        author: "lucas",
        assignees: ["lucas", "james"],
        createdDaysAgo: 24,
        comments: [
            { by: "lucas", text: "Staging rehearsal went well: 3m40s of write downtime. Two extensions needed version bumps.", daysAgo: 6 },
            { by: "james", text: "Proposed production window: Sunday 06:00 UTC. Posted in #eng-announce.", daysAgo: 2 },
        ],
    },
    {
        project: "platform",
        title: "PagerDuty alert for disk usage fires every night during backups",
        description:
            "The 80% disk alert on db-replica-2 fires around 02:00 every night while the backup snapshot is written, then clears by itself. It's paged on-call 9 times this month.",
        type: "BUG",
        status: "CLOSED",
        priority: "MEDIUM",
        author: "james",
        assignees: ["lucas"],
        createdDaysAgo: 19,
        comments: [
            { by: "lucas", text: "Moved snapshots to a separate volume and changed the alert to sustained-for-15m. No pages in the last week.", daysAgo: 12 },
        ],
    },
    {
        project: "platform",
        title: "Reduce p95 latency on GET /search",
        description:
            "p95 is 820ms. A trace shows two sequential queries plus a full rescore. Candidates: a trigram index on title and caching facet counts.",
        type: "TASK",
        status: "OPEN",
        priority: "HIGH",
        author: "maya",
        assignees: ["daniel"],
        createdDaysAgo: 8,
        escalatedFrom: "MEDIUM",
    },
    {
        project: "platform",
        title: "Rotate database credentials and move them to the secrets manager",
        description: "Credentials are currently in plain env vars on two legacy workers. Move them to the secrets manager and rotate.",
        type: "TASK",
        status: "CLOSED",
        priority: "HIGH",
        author: "lucas",
        assignees: ["james"],
        createdDaysAgo: 40,
    },
    {
        project: "platform",
        title: "Worker pods OOM-killed when the email digest job runs",
        description:
            "The weekly digest loads every subscriber into memory. Pods get OOM-killed at about 1.2M subscribers. Needs cursor-based batching.",
        type: "BUG",
        status: "OPEN",
        priority: "MEDIUM",
        author: "james",
        assignees: ["lucas"],
        createdDaysAgo: 2,
    },
    {
        project: "platform",
        title: "Add structured request IDs to API logs",
        description:
            "Generate a request ID at the edge, pass it to downstream services, and include it in every log line so we can follow a request across services.",
        type: "FEATURE",
        status: "CLOSED",
        priority: "LOW",
        author: "daniel",
        assignees: ["daniel"],
        createdDaysAgo: 35,
    },

    // --- Customer Support Portal ---
    {
        project: "support",
        title: "Help center search returns no results for plurals",
        description: "Searching \"invoices\" finds nothing while \"invoice\" returns 14 articles. We need stemming on the article index.",
        type: "BUG",
        status: "OPEN",
        priority: "MEDIUM",
        author: "sofia",
        assignees: ["priya"],
        createdDaysAgo: 6,
        dueInDays: 20,
    },
    {
        project: "support",
        title: "Sync new portal tickets to Zendesk",
        description:
            "Tickets created in the portal should appear in Zendesk within a minute, with the customer's org and plan attached as custom fields.",
        type: "FEATURE",
        status: "IN_PROGRESS",
        priority: "HIGH",
        author: "maya",
        assignees: ["priya", "daniel"],
        createdDaysAgo: 17,
        dueInDays: 15,
        comments: [
            { by: "priya", text: "Webhook pipeline is working in staging. Waiting on Zendesk admin access to create the custom fields.", daysAgo: 7 },
            { by: "sofia", text: "Access granted. You should both have admin now.", daysAgo: 6 },
        ],
    },
    {
        project: "support",
        title: "SSO login for enterprise customers",
        description:
            "Support SAML SSO for enterprise orgs so their employees can open tickets without a separate password. Start with Okta and Azure AD.",
        type: "FEATURE",
        status: "OPEN",
        priority: "MEDIUM",
        author: "maya",
        assignees: [],
        createdDaysAgo: 14,
        dueInDays: 40,
    },
    {
        project: "support",
        title: "Write launch help articles for billing and invoices",
        description: "Ten articles covering invoices, payment methods, refunds and tax documents. Drafts need review by the finance team.",
        type: "TASK",
        status: "IN_PROGRESS",
        priority: "LOW",
        author: "sofia",
        assignees: ["sofia"],
        createdDaysAgo: 10,
        dueInDays: 11,
    },
    {
        project: "support",
        title: "Attachment upload fails for files over 10MB",
        description: "Customers attaching log bundles get a generic error. The ingress caps request bodies at 10MB while the UI promises 25MB.",
        type: "BUG",
        status: "CLOSED",
        priority: "HIGH",
        author: "priya",
        assignees: ["daniel"],
        createdDaysAgo: 13,
        dueInDays: -4,
        comments: [
            { by: "daniel", text: "Uploads now go straight to object storage with presigned URLs, so they skip the ingress. Tested up to 25MB.", daysAgo: 9 },
        ],
    },
    {
        project: "support",
        title: "Show estimated first-response time on the new ticket form",
        description:
            "Show the expected first-response time for the customer's plan (e.g. \"Usually within 4 business hours\") before they submit.",
        type: "FEATURE",
        status: "OPEN",
        priority: "LOW",
        author: "sofia",
        assignees: ["priya"],
        createdDaysAgo: 1,
        dueInDays: 30,
    },
];

// --- Seed logic ---------------------------------------------------------------

type Db = PrismaClient;

async function pickAvailableUsername(prisma: Db, base: string): Promise<string> {
    for (let suffix = 0; ; suffix++) {
        const candidate = suffix === 0 ? base : `${base}${suffix + 1}`;
        const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { userId: true } });
        if (!taken) return candidate;
    }
}

// Upsert keyed on email. `update` only touches fields we deliberately reset.
async function upsertPerson(
    prisma: Db,
    spec: { username: string; email: string },
    role: Role,
    passwordHash: string | null,
    resetOnRerun: boolean
): Promise<number> {
    const existing = await prisma.user.findUnique({ where: { email: spec.email } });
    if (existing) {
        if (resetOnRerun) {
            await prisma.user.update({
                where: { userId: existing.userId },
                data: { password: passwordHash, role, deletedAt: null },
            });
        }
        return existing.userId;
    }

    const created = await prisma.user.create({
        data: {
            cognitoId: `demo-${randomUUID()}`,
            username: await pickAvailableUsername(prisma, spec.username),
            email: spec.email,
            password: passwordHash,
            role,
        },
    });
    return created.userId;
}

async function seedPeople(prisma: Db): Promise<Record<PersonKey, number>> {
    const demoHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
    const ids = {} as Record<PersonKey, number>;

    for (const [key, role] of Object.entries(DEMO_LOGIN_PEOPLE) as ["maya" | "daniel", Role][]) {
        ids[key] = await upsertPerson(prisma, DEMO_ACCOUNTS[role], role, demoHash, true);
    }
    for (const [key, spec] of Object.entries(TEAMMATES) as [Exclude<PersonKey, "maya" | "daniel">, { username: string; email: string }][]) {
        ids[key] = await upsertPerson(prisma, spec, "DEVELOPER", null, false);
    }
    return ids;
}

async function seedProject(
    prisma: Db,
    spec: ProjectSpec,
    people: Record<PersonKey, number>
): Promise<{ projectId: number; created: boolean }> {
    const memberIds = spec.members.map((key) => people[key]);
    const existing = await prisma.project.findFirst({ where: { name: spec.name }, select: { projectId: true } });

    if (existing) {
        // Re-connect members so recreated demo logins still see the project.
        // connect is a no-op for users who are already members.
        await prisma.project.update({
            where: { projectId: existing.projectId },
            data: { teamMembers: { connect: memberIds.map((userId) => ({ userId })) } },
        });
        return { projectId: existing.projectId, created: false };
    }

    const creatorId = people.maya;
    const project = await prisma.project.create({
        data: {
            name: spec.name,
            description: spec.description,
            startDate: spec.startDate,
            endDate: spec.endDate,
            createdByUserId: creatorId,
            createdAt: spec.startDate,
            teamMembers: { connect: memberIds.map((userId) => ({ userId })) },
        },
    });

    await prisma.activity.createMany({
        data: memberIds
            .filter((userId) => userId !== creatorId)
            .map((userId, i) => ({
                action: "MEMBER_ADDED" as const,
                newValue: String(userId),
                actorUserId: creatorId,
                projectId: project.projectId,
                createdAt: new Date(spec.startDate.getTime() + (i + 1) * 60 * 1000),
            })),
    });

    return { projectId: project.projectId, created: true };
}

async function seedTicket(
    prisma: Db,
    spec: TicketSpec,
    projectId: number,
    people: Record<PersonKey, number>
): Promise<boolean> {
    const assigneeIds = spec.assignees.map((key) => people[key]);
    const existing = await prisma.ticket.findFirst({
        where: { projectId, title: spec.title },
        select: { ticketId: true },
    });

    if (existing) {
        // Keep assignments pointing at current demo-user ids; the unique
        // (userId, ticketId) key makes this idempotent.
        for (const userId of assigneeIds) {
            await prisma.ticketAssignment.upsert({
                where: { userId_ticketId: { userId, ticketId: existing.ticketId } },
                update: {},
                create: { userId, ticketId: existing.ticketId },
            });
        }
        return false;
    }

    const createdAt = daysAgo(spec.createdDaysAgo, 9 + (spec.title.length % 8), (spec.title.length * 7) % 60);
    const authorId = people[spec.author];
    const actorId = assigneeIds[0] ?? authorId;
    const hoursAfterCreate = (hours: number) => new Date(createdAt.getTime() + hours * 60 * 60 * 1000);

    // History, oldest first. Status moves are attributed to the first
    // assignee; escalations to the admin.
    const activities: {
        action: "FIELD_CHANGED" | "ASSIGNEE_ADDED";
        field?: string;
        oldValue?: string;
        newValue: string;
        actorUserId: number;
        createdAt: Date;
    }[] = assigneeIds.map((userId, i) => ({
        action: "ASSIGNEE_ADDED",
        newValue: String(userId),
        actorUserId: authorId,
        createdAt: hoursAfterCreate(0.1 * (i + 1)),
    }));

    if (spec.escalatedFrom) {
        activities.push({
            action: "FIELD_CHANGED",
            field: "priority",
            oldValue: spec.escalatedFrom,
            newValue: spec.priority,
            actorUserId: people.maya,
            createdAt: hoursAfterCreate(20),
        });
    }

    // Clamp a timestamp so history never lands in the future.
    const elapsedHours = (now - createdAt.getTime()) / (60 * 60 * 1000);
    const at = (hours: number) => hoursAfterCreate(Math.min(hours, elapsedHours * 0.9));

    if (spec.status === "IN_PROGRESS" || spec.status === "CLOSED") {
        activities.push({
            action: "FIELD_CHANGED",
            field: "status",
            oldValue: "OPEN",
            newValue: "IN_PROGRESS",
            actorUserId: actorId,
            createdAt: at(26),
        });
    }
    if (spec.status === "CLOSED") {
        activities.push({
            action: "FIELD_CHANGED",
            field: "status",
            oldValue: "IN_PROGRESS",
            newValue: "CLOSED",
            actorUserId: actorId,
            createdAt: at(Math.max(48, elapsedHours * 0.6)),
        });
    }

    const lastActivity = [createdAt, ...activities.map((a) => a.createdAt)].reduce((a, b) => (a > b ? a : b));

    // One transaction per ticket, so a failed run never leaves a ticket
    // without its assignments/comments/history (and a rerun picks it up).
    await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.create({
            data: {
                title: spec.title,
                description: spec.description,
                type: spec.type,
                status: spec.status,
                priority: spec.priority,
                startDate: createdAt,
                dueDate: spec.dueInDays === undefined ? null : daysFromNow(spec.dueInDays),
                createdAt,
                updatedAt: lastActivity,
                projectId,
                authorUserId: authorId,
            },
        });

        if (assigneeIds.length > 0) {
            await tx.ticketAssignment.createMany({
                data: assigneeIds.map((userId) => ({ userId, ticketId: ticket.ticketId, assignedAt: createdAt })),
            });
        }

        await tx.activity.createMany({
            data: activities.map((a) => ({ ...a, ticketId: ticket.ticketId })),
        });

        for (const comment of spec.comments ?? []) {
            await tx.comment.create({
                data: {
                    text: comment.text,
                    ticketId: ticket.ticketId,
                    userId: people[comment.by],
                    createdAt: daysAgo(comment.daysAgo, 11 + (comment.text.length % 6), comment.text.length % 60),
                },
            });
        }
    });

    return true;
}

export async function seedDemo(prisma: Db): Promise<void> {
    const people = await seedPeople(prisma);
    console.log(`Demo users ready (${Object.keys(people).length}).`);

    const projectIds = {} as Record<ProjectKey, number>;
    for (const [key, spec] of Object.entries(PROJECTS) as [ProjectKey, ProjectSpec][]) {
        const { projectId, created } = await seedProject(prisma, spec, people);
        projectIds[key] = projectId;
        console.log(`${created ? "Created" : "Kept existing"} project "${spec.name}"`);
    }

    let createdTickets = 0;
    for (const spec of TICKETS) {
        if (await seedTicket(prisma, spec, projectIds[spec.project], people)) createdTickets++;
    }
    console.log(`Tickets: ${createdTickets} created, ${TICKETS.length - createdTickets} already present.`);

    console.log("\nDemo logins (password for all: " + DEMO_PASSWORD + "):");
    for (const [role, account] of Object.entries(DEMO_ACCOUNTS)) {
        console.log(`  ${role.padEnd(10)} ${account.email}`);
    }
}

const isMainModule =
    process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is missing");

    // Print only the host, never credentials, so it's obvious which
    // database is about to be written to.
    console.log(`Seeding demo data into ${new URL(connectionString).host} ...\n`);

    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    seedDemo(prisma)
        .catch((err) => {
            console.error(err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
