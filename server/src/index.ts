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


//config 
dotenv.config();
const app = express();
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({policy: "cross-origin"}))
app.use(morgan("common"))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cors());

//routes
app.get("/", (req, res)=> {
    res.send("home route")
})
app.use("/projects", projectRoutes)
app.use("/tickets", ticketRoutes)
app.use("/users", userRoutes)
app.use("/tickets/:ticketId/comments", commentRoutes)
app.use("/comments", commentRoutes)
app.use("/search", searchRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  console.error("Server error:", err);
  console.error(err?.stack);

  res.status(500).json({
    message: err?.message ?? "Internal Server Error",
  });
});
//server
const port = process.env.PORT || 3000;
app.listen(port, ()=>
console.log(`Server running on ${port}`))