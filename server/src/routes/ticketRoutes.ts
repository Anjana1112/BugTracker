import {Router } from "express"
import { getTickets, getTicket, createTicket, editTicketAssignedUsers, editTicket, updateTicketStatus, deleteTicket } from "../controllers/ticketController.js"

const router = Router();

router.get("/", getTickets);
router.get("/:ticketId", getTicket)
router.post("/", createTicket)
router.patch("/:ticketId", editTicket)
router.delete("/:ticketId", deleteTicket)
router.patch("/:ticketId/assignedUsers", editTicketAssignedUsers)
router.patch("/:ticketId/status", updateTicketStatus)


export default router;