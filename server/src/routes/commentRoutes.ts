import { Router } from "express"
import {
    getTicketComments,
    createTicketComment,
    editTicketComment,
    deleteTicketComment,
    createAttachmentUploadUrl
} from "../controllers/commentController.js"

const router = Router({ mergeParams: true })

// /tickets/:ticketId/comments
router.get("/", getTicketComments)
router.post("/", createTicketComment)
router.post("/attachments/upload-url", createAttachmentUploadUrl)

// /comments/:commentId
router.patch("/:commentId", editTicketComment)
router.delete("/:commentId", deleteTicketComment)

export default router
