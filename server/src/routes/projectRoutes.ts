import {Router } from "express"
import { getProject, getProjects, getProjectTickets, createProject, editProject, deleteProject, getProjectMembers, addProjectMembers, removeProjectMembers, getProjectActivity } from "../controllers/projectController.js"
import { requireAdmin } from "../middleware/requireAdmin.js"

const router = Router();

router.get("/", getProjects);
router.get("/:projectId", getProject)
router.post("/", createProject)
router.patch("/:projectId", editProject)
router.delete("/:projectId", deleteProject)
router.get("/:projectId/tickets", getProjectTickets)
router.get("/:projectId/members", getProjectMembers)
router.post("/:projectId/members", requireAdmin, addProjectMembers)
router.delete("/:projectId/members/:userId", requireAdmin, removeProjectMembers)
router.get("/:projectId/activity", getProjectActivity)

export default router;