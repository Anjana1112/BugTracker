import {Router } from "express"
import { getProject, getProjects, getProjectTickets, createProject, editProject, deleteProject, getProjectMembers, addProjectMembers, removeProjectMembers } from "../controllers/projectController.js"

const router = Router();

router.get("/", getProjects);
router.get("/:projectId", getProject)
router.post("/", createProject)
router.patch("/:projectId", editProject)
router.delete("/:projectId", deleteProject)
router.get("/:projectId/tickets", getProjectTickets)
router.get("/:projectId/members", getProjectMembers)
router.post("/:projectId/members", addProjectMembers)
router.delete("/:projectId/members/:userId", removeProjectMembers)

export default router;