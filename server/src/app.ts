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
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({policy: "cross-origin"}))
app.use(morgan("common"))
app.use(cors());
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

  res.status(500).json({
    message: err?.message ?? "Internal Server Error",
  });
});

export default app
