import type { Request, Response } from "express"
import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../generated/prisma/client.js"
import { isAdmin } from "../middleware/requireAdmin.js"
import { assertMinLength } from "../lib/validation.js"
import { handleControllerError } from "../lib/errorHandler.js"
import { BCRYPT_COST } from "../lib/config.js"

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

        const requesterIsAdmin = await isAdmin(req.user!.userId)

        if (req.user!.userId !== userId && !requesterIsAdmin) {
        res.status(403).json({ message: "You can only edit your own account" })
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

        if (role !== undefined && !requesterIsAdmin) {
        res.status(403).json({ message: "Only an admin can change roles" })
        return
        }

        if (role !== undefined && role !== "ADMIN" && existingUser.role === "ADMIN") {
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
        if (adminCount <= 1) {
            res.status(403).json({ message: "Cannot demote the last remaining admin" })
            return
        }
        }

        const updatedUser = await prisma.user.update({
        where: { userId },
        data: {
            ...(username !== undefined ? { username } : {}),
            ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
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

        if (req.user!.userId === userId) {
            res.status(403).json({ message: "You cannot delete your own account" })
            return
        }

        // No separate "last remaining admin" check needed here: this route
        // requires the requester to already be an admin (see requireAdmin in
        // userRoutes.ts), so the only way the target could be the sole
        // remaining admin is if they're deleting themselves — already
        // blocked above.
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
//users/me
// Self-service account deletion. Doesn't hard-delete the row — Ticket.author
// and Comment.author are ON DELETE RESTRICT, so any user who has authored a
// ticket or comment can't be removed outright without orphaning that content.
// Instead this anonymizes the account (username/email/password/avatar
// scrubbed, role reset) so their authored tickets/comments remain intact
// under a generic name, and the row can never be logged into again.
export const deleteMyAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId

        const existingUser = await prisma.user.findUnique({ where: { userId } })
        if (!existingUser) {
            res.status(404).json({ message: "User not found" })
            return
        }

        const { password } = req.body as { password?: string }

        if (existingUser.password) {
            if (!password) {
                res.status(400).json({ message: "password is required to delete your account" })
                return
            }
            const passwordMatches = await bcrypt.compare(password, existingUser.password)
            if (!passwordMatches) {
                res.status(401).json({ message: "Incorrect password" })
                return
            }
        }

        if (existingUser.role === "ADMIN") {
            const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
            if (adminCount <= 1) {
                res.status(403).json({ message: "Cannot delete the last remaining admin account" })
                return
            }
        }

        await prisma.user.update({
            where: { userId },
            data: {
                username: `deleted-user-${userId}`,
                email: `deleted-user-${userId}@deleted.local`,
                password: null,
                profilePictureUrl: null,
                role: "DEVELOPER",
                deletedAt: new Date(),
            },
        })

        res.json({ message: "Account deleted successfully" })
    } catch (err: any) {
        res.status(500).json({ message: `error deleting account: ${err.message}` })
    }
}
//users/:userId/password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = Number(req.params.userId)
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user id" })
            return
        }

        if (req.user!.userId !== userId) {
            res.status(403).json({ message: "You can only change your own password" })
            return
        }

        const { currentPassword, newPassword } = req.body as {
            currentPassword?: string
            newPassword?: string
        }

        if (!currentPassword || !newPassword) {
            res.status(400).json({ message: "currentPassword and newPassword are required" })
            return
        }

        assertMinLength(newPassword, 8, "New password")

        const existingUser = await prisma.user.findUnique({ where: { userId } })
        if (!existingUser) {
            res.status(404).json({ message: "User not found" })
            return
        }

        if (!existingUser.password) {
            res.status(400).json({
                message: "This account has no password set (signed in via GitHub)",
            })
            return
        }

        const passwordMatches = await bcrypt.compare(currentPassword, existingUser.password)
        if (!passwordMatches) {
            res.status(401).json({ message: "Current password is incorrect" })
            return
        }

        const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST)
        await prisma.user.update({
            where: { userId },
            data: { password: newPasswordHash },
        })

        res.json({ message: "Password updated successfully" })
    } catch (err: any) {
        handleControllerError(err, res, "error changing password")
    }
}
