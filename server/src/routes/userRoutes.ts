import { Router } from "express"
import { getUsers, getUser, editUser, deleteUser } from "../controllers/userController.js"

const router = Router();

router.get("/", getUsers);
router.get("/:userId", getUser)
router.patch("/:userId", editUser)
router.delete("/:userId", deleteUser)


export default router;