import type { Request, Response } from "express"
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../generated/prisma/client.js"

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL is missing")

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

//users
export const getUsers = async (req: Request, res: Response): Promise<void> =>{
    try {
        const users = await prisma.user.findMany({
            select: {
            userId: true,
            username: true,
            email: true,
            profilePictureUrl: true,
            role: true,
        },
        })

        res.json(users)
    } catch (err: any) {
        res.status(500).json({
        message: `error retrieving users: ${err.message}`,})
    }
}
//users/:userId
export const getUser = async (req: Request, res: Response): Promise<void> =>{
    try {
        const userId = Number(req.params.userId)
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user id" })
            return
        }
        const user = await prisma.user.findUnique({
            where :{userId},
            select: {
                userId: true,
                username: true,
                email: true,
                profilePictureUrl: true,
                role: true,
            },
        })
        if (!user) {
            res.status(404).json({ message: "User not found" })
            return
        }
        res.json(user)
    } catch (err: any) {
        res.status(500).json({
        message: `error retrieving users: ${err.message}`,})
    }
}
//users/:userId
export const editUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = Number(req.params.userId)

        if (isNaN(userId)) {
        res.status(400).json({ message: "Invalid user id" })
        return
        }

        const { username, email, profilePictureUrl, role } = req.body as {
        username?: string
        email?: string
        profilePictureUrl?: string | null
        role?: "ADMIN" | "DEVELOPER"
        }

        if (
        username === undefined &&
        email === undefined &&
        profilePictureUrl === undefined &&
        role === undefined
        ) {
        res.status(400).json({ message: "No fields provided to update" })
        return
        }

        const existingUser = await prisma.user.findUnique({
        where: { userId },
        })

        if (!existingUser) {
        res.status(404).json({ message: "User not found" })
        return
        }

        const validRoles = ["ADMIN", "DEVELOPER"]
        if (role !== undefined && !validRoles.includes(role)) {
        res.status(400).json({ message: "Invalid role value" })
        return
        }

        const updatedUser = await prisma.user.update({
        where: { userId },
        data: {
            ...(username !== undefined ? { username } : {}),
            ...(email !== undefined ? { email } : {}),
            ...(profilePictureUrl !== undefined
            ? { profilePictureUrl: profilePictureUrl ?? null }
            : {}),
            ...(role !== undefined ? { role } : {}),
        },
        select: {
            userId: true,
            username: true,
            email: true,
            profilePictureUrl: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
        })

        res.json(updatedUser)
    } catch (err: any) {
        if (err?.code === "P2002") {
        res.status(409).json({ message: "Username already exists" })
        return
        }

        res.status(500).json({
        message: `error updating user: ${err.message}`,
        })
    }
}
//users/:userId
export const deleteUser = async (req: Request, res: Response): Promise<void> =>{
    try {
        const userId = Number(req.params.userId)
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user id" })
            return
        }
        const existingUser = await prisma.user.findUnique({ where: { userId } })
        if (!existingUser) {
            res.status(404).json({ message: "User not found" })
            return
        }
        await prisma.user.delete({ where: { userId } })
        res.json({ message: "User deleted successfully" })
    } catch (err: any) { 
        res.status(500).json({ message: `error deleting user: ${err.message}` })
     }
}
// //users/me
// export const getMe = async (req: Request, res: Response): Promise<void> =>{

// }
// //users/me
// export const editMe = async (req: Request, res: Response): Promise<void> =>{

// }
