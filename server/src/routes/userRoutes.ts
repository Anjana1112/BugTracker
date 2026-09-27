import { Router } from "express"
import { getUsers, getUser, editUser, deleteUser, deleteMyAccount, changePassword } from "../controllers/userController.js"
import { requireAdmin } from "../middleware/requireAdmin.js"

const router = Router();

router.get("/", getUsers);
router.delete("/me", deleteMyAccount)
router.get("/:userId", getUser)
router.patch("/:userId", editUser)
router.patch("/:userId/password", changePassword)
router.delete("/:userId", requireAdmin, deleteUser)


export default router;