import { Router } from "express"
import { getUsers, getUser, editUser, deleteUser, deleteMyAccount, changePassword } from "../controllers/userController.js"
import { requireAdmin } from "../middleware/requireAdmin.js"
import { blockDemoAccounts } from "../middleware/demoMode.js"

const router = Router();

router.get("/", getUsers);
router.delete("/me", blockDemoAccounts, deleteMyAccount)
router.get("/:userId", getUser)
router.patch("/:userId", editUser)
router.patch("/:userId/password", blockDemoAccounts, changePassword)
router.delete("/:userId", blockDemoAccounts, requireAdmin, deleteUser)


export default router;