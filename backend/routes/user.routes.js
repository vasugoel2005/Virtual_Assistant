import express from "express"
import rateLimit from "express-rate-limit"
import { askToAssistant, getCurrentUser, updateAssistant } from "../controllers/user.controllers.js"
import isAuth from "../middlewares/isAuth.js"
import upload from "../middlewares/multer.js"

const userRouter=express.Router()

// caps how often one user can call Gemini, since each call costs money/quota
const assistantLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { response: "Too many requests, please slow down and try again shortly." },
})

userRouter.get("/current",isAuth,getCurrentUser)
userRouter.post("/update",isAuth,upload.single("assistantImage"),updateAssistant)
userRouter.post("/asktoassistant",isAuth,assistantLimiter,askToAssistant)

export default userRouter