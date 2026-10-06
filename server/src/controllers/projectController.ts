import type { Request, Response } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import {
    requireNonEmptyString,
    parseOptionalDate,
    assertProjectDateOrder,
    assertUsersExist,
    assertNotLastProjectMember,
} from "../lib/validation.js";
import { handleControllerError } from "../lib/errorHandler.js";
import { diffFields, buildMemberActivityInputs } from "../lib/activity.js";
import { projectMemberWhere } from "../lib/access.js";
import { isAdmin } from "../middleware/requireAdmin.js";
import { DEMO_MODE_MESSAGE, isDemoUser } from "../middleware/demoMode.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Member-roster management is admin-only OR the project's own creator —
// deliberately not scoped to project membership at all (see access.ts):
// an admin who isn't a member, or a creator who removed themself, must
// still be able to manage the roster.
async function isProjectCreatorOrAdmin(createdByUserId: number | null, req: Request): Promise<boolean> {
    if (createdByUserId !== null && req.user!.userId === createdByUserId) return true;
    return isAdmin(req.user!.userId);
}

// Roster management is the one place admin/creator rights reach beyond
// membership (above). Demo logins don't get that reach: they may only manage
// projects they're already a member of — otherwise the demo admin could add
// itself to any real project and gain full access to it.
function demoUserIsMember(teamMembers: { userId: number }[], req: Request): boolean {
    if (!isDemoUser(req)) return true;
    return teamMembers.some((member) => member.userId === req.user!.userId);
}

//projects
export const getProjects = async (req: Request, res: Response): Promise<void> =>{
    try{
        const projects = await prisma.project.findMany({
            where: { teamMembers: { some: { userId: req.user!.userId } } },
            include: { teamMembers: {
                select: {
                    userId: true,
                    username: true,
                    email: true,
                }
            } },
            orderBy: {
                createdAt: "desc",
            },
        });
        res.json(projects);
    } catch (err:any){
        res.status(500).json({message: `error retrieving projects: ${err.message}`})
    }
}
//projects/:projectId
export const getProject= async (req: Request, res: Response): Promise<void> =>{
    try{
        const projectId = Number(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: "Invalid project id" })
            return
        }
        const project = await prisma.project.findFirst({
            where: { projectId, teamMembers: { some: { userId: req.user!.userId } } },
            include: { teamMembers: {
                select: {
                    userId: true,
                    username: true,
                    email: true,
                }
            } }
        })
        if (!project) {
            res.status(404).json({ message: "Project not found" })
            return
        }
        res.json(project)
    } catch (err: any){
        res.status(500).json({message: `error retrieving project: ${err.message}`})
    }
}
//projects
export const createProject= async (req: Request, res: Response): Promise<void> =>{
    try{
        const { name, description, startDate, endDate, teamMembers }= req.body;

        const validName = requireNonEmptyString(name, "Project name");
        const parsedStartDate = parseOptionalDate(startDate, "Start date");
        const parsedEndDate = parseOptionalDate(endDate, "End date");
        assertProjectDateOrder(parsedStartDate, parsedEndDate);

        const memberIds = new Set<number>(
            Array.isArray(teamMembers) ? teamMembers.map((userId: number) => Number(userId)) : []
        );
        // Always include the creator so they remain a member of the project they made.
        memberIds.add(req.user!.userId);

        const existingUsers = await prisma.user.findMany({
            where: { userId: { in: Array.from(memberIds) } },
            select: { userId: true },
        });
        assertUsersExist(Array.from(memberIds), new Set(existingUsers.map((u) => u.userId)));

        const data: any = {
            name: validName,
            description: description || null,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            createdByUserId: req.user!.userId,
            teamMembers: {
                connect: Array.from(memberIds).map((userId) => ({ userId })),
            },
        }
        const newProject = await prisma.project.create({
            data,
            include: {
                teamMembers: {
                    select: {
                        userId: true,
                        username: true,
                        email: true,
                    }
                }
            }
        });
        res.status(201).json(newProject);
    } catch (err:any){
        handleControllerError(err, res, "error creating project");
    }
}
//projects/:projectId
export const editProject= async (req: Request, res: Response): Promise<void> =>{
    try {
        const projectId = Number(req.params.projectId);

        if (isNaN(projectId)) {
            res.status(400).json({ message: "Invalid project id" });
            return;
        }

        const { name, description, startDate, endDate, teamMembers } = req.body as {
            name?: string;
            description?: string | null;
            startDate?: string | null;
            endDate?: string | null;
            teamMembers: number[];
        };
        if (
            name === undefined &&
            description === undefined &&
            startDate === undefined &&
            endDate === undefined &&
            teamMembers === undefined
        ) {
            res.status(400).json({ message: "No fields provided to update" });
            return;
        }
        const existing = await prisma.project.findFirst({
            where: { projectId, ...projectMemberWhere(req.user!.userId) },
            include: { teamMembers: { select: { userId: true } } },
        });
        if (!existing) {
            res.status(404).json({ message: "Project not found" });
            return;
        }

        const validName = name !== undefined ? requireNonEmptyString(name, "Project name") : undefined;
        const parsedStartDate = startDate !== undefined ? parseOptionalDate(startDate, "Start date") : undefined;
        const parsedEndDate = endDate !== undefined ? parseOptionalDate(endDate, "End date") : undefined;

        // Date-order check must account for fields not present in this
        // request (a partial update), falling back to the existing value.
        const resolvedStartDate = parsedStartDate !== undefined ? parsedStartDate : existing.startDate;
        const resolvedEndDate = parsedEndDate !== undefined ? parsedEndDate : existing.endDate;
        assertProjectDateOrder(resolvedStartDate, resolvedEndDate);

        if (teamMembers !== undefined && teamMembers.length > 0) {
            const requestedIds = teamMembers.map((userId) => Number(userId));
            const existingUsers = await prisma.user.findMany({
                where: { userId: { in: requestedIds } },
                select: { userId: true },
            });
            assertUsersExist(requestedIds, new Set(existingUsers.map((u) => u.userId)));
        }

        const data: any = {
            ...(validName !== undefined ? { name: validName } : {}),
            ...(description !== undefined ? { description: description ?? null } : {}),
            ...(parsedStartDate !== undefined ? { startDate: parsedStartDate } : {}),
            ...(parsedEndDate !== undefined ? { endDate: parsedEndDate } : {}),
        }
        if (teamMembers!==undefined){
            data.teamMembers = {
                set: teamMembers.map((userId: number)=> ({
                    userId: Number(userId)
                }))
            }
        }

        const fieldDiffs = diffFields(
            existing,
            {
                name: validName !== undefined ? validName : existing.name,
                description: description !== undefined ? (description ?? null) : existing.description,
                startDate: resolvedStartDate,
                endDate: resolvedEndDate,
            },
            ["name", "description", "startDate", "endDate"]
        );
        const memberActivityInputs =
            teamMembers !== undefined
                ? buildMemberActivityInputs(
                    existing.teamMembers.map((m) => m.userId),
                    teamMembers.map((userId) => Number(userId)),
                    req.user!.userId,
                    projectId
                )
                : [];
        const activityInputs = [
            ...fieldDiffs.map((d) => ({
                action: "FIELD_CHANGED" as const,
                field: d.field,
                oldValue: d.oldValue,
                newValue: d.newValue,
                actorUserId: req.user!.userId,
                projectId,
            })),
            ...memberActivityInputs,
        ];

        const [updated] = await prisma.$transaction([
            prisma.project.update({
            where: { projectId },
            data,
            include: {
                teamMembers: {
                    select: {
                        userId: true,
                        username: true,
                        email: true
                    }
                }
            }
            }),
            ...(activityInputs.length > 0 ? [prisma.activity.createMany({ data: activityInputs })] : []),
        ]);

    res.json(updated);
  } catch (err: any) {
    handleControllerError(err, res, "error updating project");
  }
}
//projects/:projectId
export const deleteProject= async (req: Request, res: Response): Promise<void> =>{
    try {
        const projectId = Number(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: "Invalid project id" });
            return;
        }
        const existingProject = await prisma.project.findFirst({
            where: { projectId, ...projectMemberWhere(req.user!.userId) },
        });
        if (!existingProject) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        await prisma.project.delete({ where: { projectId } });
        res.json({ message: "Project deleted successfully" });
    } catch (err: any) {
        handleControllerError(err, res, "error deleting project");
     }
}
//projects/:projectId/tickets
export const getProjectTickets = async (req: Request, res: Response): Promise<void> =>{
    try {
        const projectId = Number(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: "Invalid project id" });
            return;
        }
        const existingProject = await prisma.project.findFirst({
            where: { projectId, teamMembers: { some: { userId: req.user!.userId } } },
        });
        if (!existingProject) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        const tickets = await prisma.ticket.findMany({
            where: {projectId},
            include:{
                 author: true,
                 ticketAssignments: {
                    include: { user: true },
                },
                comments: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        })
        res.json(tickets)

    }catch(err:any){
        res.status(500).json({
            message: `error retrieving tickets: ${err.message}`,
        });
    }
}
//projects/:projectId/members
export const getProjectMembers= async (req: Request, res: Response): Promise<void> =>{
    try {
        const projectId = Number(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: "Invalid project id" });
            return;
        }

        const project = await prisma.project.findFirst({
            where: { projectId, teamMembers: { some: { userId: req.user!.userId } } },
            include: {
                teamMembers: {
                    select: {
                        userId: true,
                        username: true,
                        email: true,
                        profilePictureUrl: true,
                        role: true,
                    },
                },
            },
        });

        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }

        res.json(project.teamMembers);
    } catch (err: any) {
        res.status(500).json({
        message: `error retrieving project members: ${err.message}`,
        });
    }
}
//projects/:projectId/members
export const addProjectMembers= async (req: Request, res: Response): Promise<void> =>{
    try{
        const projectId = Number(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: "Invalid project id" });
            return;
        }
        const {teamMembers} = req.body as {
            teamMembers: number[];
        }
        if (!Array.isArray(teamMembers) || teamMembers.length === 0) {
            res.status(400).json({
            message: "teamMembers must be a non-empty array of user ids",
            });
            return;
        }
        const existingProject = await prisma.project.findUnique({
            where: { projectId },
            include: { teamMembers: { select: { userId: true } } },
        })
        if (!existingProject) {
            res.status(404).json({ message: "Project not found" });
            return;
        }

        if (!demoUserIsMember(existingProject.teamMembers, req)) {
            res.status(403).json({ message: DEMO_MODE_MESSAGE });
            return;
        }

        if (!(await isProjectCreatorOrAdmin(existingProject.createdByUserId, req))) {
            res.status(403).json({ message: "Only the project's creator or an admin can add members" });
            return;
        }

        const requestedIds = teamMembers.map((userId) => Number(userId));
        const existingUsers = await prisma.user.findMany({
            where: { userId: { in: requestedIds } },
            select: { userId: true },
        });
        assertUsersExist(requestedIds, new Set(existingUsers.map((u) => u.userId)));

        // Only log ids that aren't already members — connecting an existing
        // member is a harmless no-op, not a real change.
        const existingMemberIds = new Set(existingProject.teamMembers.map((m) => m.userId));
        const activityInputs = requestedIds
            .filter((userId) => !existingMemberIds.has(userId))
            .map((userId) => ({
                action: "MEMBER_ADDED" as const,
                newValue: String(userId),
                actorUserId: req.user!.userId,
                projectId,
            }));

        const [updatedProject] = await prisma.$transaction([
            prisma.project.update({
            where: { projectId },
            data: {
                teamMembers: {
                    connect: requestedIds.map((userId) => ({ userId })),
                },
            },
            include: {
                teamMembers:{
                    select:{
                        userId: true,
                        username: true,
                        email: true,
                    }
                }
            }
            }),
            ...(activityInputs.length > 0 ? [prisma.activity.createMany({ data: activityInputs })] : []),
        ])
        res.status(200).json(updatedProject);
    } catch(err: any){
        handleControllerError(err, res, "error adding project members");
    }
}
//projects/:projectId/members/:userId
export const removeProjectMembers = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = Number(req.params.projectId)
        const userId = Number(req.params.userId)

        if (isNaN(projectId) || isNaN(userId)) {
        res.status(400).json({ message: "Invalid project id or user id" })
        return
        }

        const existingProject = await prisma.project.findUnique({
        where: { projectId },
        include: { teamMembers: { select: { userId: true } } },
        })
        if (!existingProject) {
        res.status(404).json({ message: "Project not found" })
        return
        }

        if (!demoUserIsMember(existingProject.teamMembers, req)) {
        res.status(403).json({ message: DEMO_MODE_MESSAGE })
        return
        }

        if (!(await isProjectCreatorOrAdmin(existingProject.createdByUserId, req))) {
        res.status(403).json({ message: "Only the project's creator or an admin can remove members" })
        return
        }

        const wasMember = existingProject.teamMembers.some((m) => m.userId === userId)
        if (!wasMember) {
        res.status(404).json({ message: "User is not a member of this project" })
        return
        }

        assertNotLastProjectMember(existingProject.teamMembers.length)

        const [updatedProject] = await prisma.$transaction([
            prisma.project.update({
            where: { projectId },
            data: {
                teamMembers: {
                disconnect: { userId },
                },
            },
            include: {
                teamMembers: {
                select: {
                    userId: true,
                    username: true,
                    email: true,
                },
                },
            },
            }),
            prisma.activity.create({
                data: {
                action: "MEMBER_REMOVED",
                oldValue: String(userId),
                actorUserId: req.user!.userId,
                projectId,
                },
            }),
        ])

        res.status(200).json(updatedProject)
    } catch (err: any) {
        handleControllerError(err, res, "error removing project members")
    }
}
//projects/:projectId/activity
export const getProjectActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = Number(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({ message: "Invalid project id" });
            return;
        }

        const project = await prisma.project.findFirst({
            where: { projectId, teamMembers: { some: { userId: req.user!.userId } } },
            select: { projectId: true },
        });
        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }

        const activity = await prisma.activity.findMany({
            where: { projectId },
            include: {
                actor: { select: { userId: true, username: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(activity);
    } catch (err: any) {
        handleControllerError(err, res, "error fetching project activity");
    }
};