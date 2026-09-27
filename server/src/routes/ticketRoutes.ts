import {Router } from "express"
import { getTickets, getTicket, createTicket, editTicketAssignedUsers, editTicket, updateTicketStatus, deleteTicket, getTicketActivity } from "../controllers/ticketController.js"

const router = Router();

router.get("/", getTickets);
router.get("/:ticketId", getTicket)
router.post("/", createTicket)
router.patch("/:ticketId", editTicket)
router.delete("/:ticketId", deleteTicket)
router.patch("/:ticketId/assignedUsers", editTicketAssignedUsers)
router.patch("/:ticketId/status", updateTicketStatus)
router.get("/:ticketId/activity", getTicketActivity)


export default router;