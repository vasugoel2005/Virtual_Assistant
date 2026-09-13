import express from "express"
import dotenv from "dotenv"
dotenv.config()
import connectDb from "./config/db.js"
import authRouter from "./routes/auth.routes.js"
import cors from "cors"
import cookieParser from "cookie-parser"
import userRouter from "./routes/user.routes.js"
import geminiResponse from "./gemini.js"


const app=express()

const isProd = process.env.NODE_ENV === "production"

// FRONTEND_URL can be a comma-separated list for multiple environments
// (e.g. "https://myapp.com,https://staging.myapp.com").
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map(o => o.trim())

app.use(cors({
    origin: (origin, callback) => {
        // allow non-browser requests (curl, server-to-server) with no origin
        if (!origin) return callback(null, true)
        // in dev, Vite sometimes bumps to a different port if 5173 is busy -
        // don't let that silently break every request, only enforce the exact
        // whitelist once we're actually in production
        if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true)
        }
        if (allowedOrigins.includes(origin)) return callback(null, true)
        callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))
const port=process.env.PORT || 5000
app.use(express.json())
app.use(cookieParser())
app.use("/api/auth",authRouter)
app.use("/api/user",userRouter)


app.listen(port,()=>{
    connectDb()
    console.log(`server started on port ${port} (${process.env.NODE_ENV || "development"})`)
})

