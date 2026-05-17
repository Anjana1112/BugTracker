import type { Request, Response } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

//projects
export const getProjects = async (req: Request, res: Response): Promise<void> =>{
    try{
        const projects = await prisma.project.findMany({
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
        const project = await prisma.project.findUnique({
            where: {projectId},
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
        const data: any = {
            name, 
            description: description || null,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
        }
        if (Array.isArray(teamMembers) && teamMembers.length > 0) {
            data.teamMembers = {
                connect: teamMembers.map((userId: number)=> ({
                    userId: Number(userId)
                }))
            }
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
        if (err?.code === "P2002") {
            res.status(409).json({ message: "Duplicate projectId (primary key collision)" });
            return;
        }
        res.status(500).json({message: `error creating project: ${err.message}`})
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
        const existing = await prisma.project.findUnique({ where: { projectId } });
        if (!existing) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        const data: any = {
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description: description ?? null } : {}),
            ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
            ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        }
        if (teamMembers!==undefined){
            data.teamMembers = {
                set: teamMembers.map((userId: number)=> ({
                    userId: Number(userId)
                }))
            }
        }
        const updated = await prisma.project.update({
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
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: `error updating project: ${err.message}` });
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
        const existingProject = await prisma.project.findUnique({ where: { projectId } });
        if (!existingProject) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        await prisma.project.delete({ where: { projectId } });
        res.json({ message: "Project deleted successfully" });
    } catch (err: any) {
        if (err?.code === "P2003") {
            res.status(409).json({
            message: "Cannot delete project because it has related records (tickets, members, etc.)",
        });
        return;}    
        res.status(500).json({ message: `error deleting project: ${err.message}` });
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
        const existingProject = await prisma.project.findUnique({ where: { projectId } });
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

        const project = await prisma.project.findUnique({
            where: { projectId },
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
        })
        if (!existingProject) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        const updatedProject = await prisma.project.update({
            where: { projectId },
            data: {
                teamMembers: {
                    connect: teamMembers.map((userId) => ({
                        userId: Number(userId),
                    })
                )},
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
        })
        res.status(200).json(updatedProject);
    } catch(err: any){
        res.status(500).json({
            message: `error adding project members: ${err.message}`,
        })
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

        const existingProject = await prisma.project.findUnique({ where: { projectId } })
        if (!existingProject) {
        res.status(404).json({ message: "Project not found" })
        return
        }

        const updatedProject = await prisma.project.update({
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
        })

        res.status(200).json(updatedProject)
    } catch (err: any) {
        res.status(500).json({ message: `error removing project members: ${err.message}` })
    }
}