import { Router } from "express"
import { globalSearch } from "../controllers/searchController.js"

const router = Router();
router.get("/", globalSearch);
export default router;