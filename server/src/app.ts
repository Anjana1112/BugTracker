import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'
import projectRoutes from './routes/projectRoutes.js'
import ticketRoutes from './routes/ticketRoutes.js'
import userRoutes from './routes/userRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import searchRoutes from './routes/searchRoutes.js'
import authRoutes from './routes/authRoutes.js'
import { requireAuth } from './middleware/auth.js'


//config
dotenv.config();
const app = express();
// Behind Render's proxy, req.ip (used by the auth rate limiter) is only the
// real client IP when Express trusts X-Forwarded-For. TRUST_PROXY sets the
// number of proxy hops; defaults to 1 in production, off otherwise.
const trustProxyHops = Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? 1 : 0));
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({policy: "cross-origin"}))
app.use(morgan("common"))
// In production only CLIENT_ORIGIN (the deployed frontend) may call the API.
// Unset in development falls back to the local Next.js dev server.
const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = process.env.CLIENT_ORIGIN ?? (isProduction ? false : "http://localhost:3000");
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//routes
app.get("/", (req, res)=> {
    res.send("home route")
})
app.use("/api", authRoutes)
app.use("/projects", requireAuth, projectRoutes)
app.use("/tickets", requireAuth, ticketRoutes)
app.use("/users", requireAuth, userRoutes)
app.use("/tickets/:ticketId/comments", requireAuth, commentRoutes)
app.use("/comments", requireAuth, commentRoutes)
app.use("/search", requireAuth, searchRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  console.error("Server error:", err);
  console.error(err?.stack);

  // Don't leak internal/Prisma error details to clients in production; the
  // full error is still logged above.
  res.status(500).json({
    message: isProduction ? "Internal server error" : err?.message ?? "Internal Server Error",
  });
});

export default app
