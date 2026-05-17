import { Router } from "express"
import {
    getTicketComments,
    createTicketComment,
    editTicketComment,
    deleteTicketComment,
    addCommentAttachment
} from "../controllers/commentController.js"

const router = Router({ mergeParams: true })

// /tickets/:ticketId/comments
router.get("/", getTicketComments)
router.post("/", createTicketComment)

// /comments/:commentId
router.patch("/:commentId", editTicketComment)
router.delete("/:commentId", deleteTicketComment)

// /comments/:commentId/attachments
router.post("/:commentId/attachments", addCommentAttachment)

export default router