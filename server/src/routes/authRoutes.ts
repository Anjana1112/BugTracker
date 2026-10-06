import { Router } from "express"
import { login, register } from "../controllers/authController.js"
import { createAuthRateLimiter } from "../middleware/rateLimit.js"

const router = Router();

// Separate limiters so sign-up attempts don't eat into the login budget.
router.post("/login", createAuthRateLimiter(), login)
router.post("/register", createAuthRateLimiter(), register)

export default router;
