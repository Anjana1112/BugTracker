import {Router } from "express"
import { getProject, getProjects, getProjectTickets, createProject, editProject, deleteProject, getProjectMembers, addProjectMembers, removeProjectMembers, getProjectActivity } from "../controllers/projectController.js"

const router = Router();

router.get("/", getProjects);
router.get("/:projectId", getProject)
router.post("/", createProject)
router.patch("/:projectId", editProject)
router.delete("/:projectId", deleteProject)
router.get("/:projectId/tickets", getProjectTickets)
router.get("/:projectId/members", getProjectMembers)
// Admin-or-creator check happens inside the controllers, not via
// requireAdmin middleware, since it also needs to allow the project's
// creator (see isProjectCreatorOrAdmin in projectController.ts).
router.post("/:projectId/members", addProjectMembers)
router.delete("/:projectId/members/:userId", removeProjectMembers)
router.get("/:projectId/activity", getProjectActivity)

export default router;