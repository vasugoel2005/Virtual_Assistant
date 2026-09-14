 import uploadOnCloudinary from "../config/cloudinary.js"
import geminiResponse from "../gemini.js"
import User from "../models/user.model.js"
import moment from "moment"
import { resolveYoutubeVideo, resolveSpotifyTrack, resolveWeather, resolveGithubUser } from "../services/mediaResolvers.js"
 export const getCurrentUser=async (req,res)=>{
    try {
        const userId=req.userId
        const user=await User.findById(userId).select("-password")
        if(!user){
return res.status(400).json({message:"user not found"})
        }

   return res.status(200).json(user)     
    } catch (error) {
       return res.status(400).json({message:"get current user error"}) 
    }
}

export const updateAssistant=async (req,res)=>{
   try {
      const {assistantName,imageUrl}=req.body
      let assistantImage;
if(req.file){
   assistantImage=await uploadOnCloudinary(req.file.path)
}else{
   assistantImage=imageUrl
}

const user=await User.findByIdAndUpdate(req.userId,{
   assistantName,assistantImage
},{new:true}).select("-password")
return res.status(200).json(user)

      
   } catch (error) {
       return res.status(400).json({message:"updateAssistantError user error"}) 
   }
}

// intents whose "response" needs to be computed live on the server instead of trusting the model
// the server (Render) runs in UTC, not the user's timezone - without this,
// get_time/get_date would report the wrong local time entirely. Hardcoded to IST
// since this app is built for Indian/Hinglish users; swap for a per-user timezone
// if you ever support other regions.
const IST_OFFSET = "+05:30"
const dateTimeResponses = {
   get_date: () => `current date is ${moment().utcOffset(IST_OFFSET).format("YYYY-MM-DD")}`,
   get_time: () => `current time is ${moment().utcOffset(IST_OFFSET).format("hh:mm A")}`,
   get_day: () => `today is ${moment().utcOffset(IST_OFFSET).format("dddd")}`,
   get_month: () => `today is ${moment().utcOffset(IST_OFFSET).format("MMMM")}`,
}

// only digits, whitespace, and basic arithmetic symbols are ever allowed through -
// this is what makes it safe to evaluate, nothing else can reach the Function call
const SAFE_MATH_EXPRESSION = /^[0-9+\-*/().%^\s]+$/

function solveCalculatorExpression(expression, fallbackResponse){
   if(!expression || !SAFE_MATH_EXPRESSION.test(expression)){
      return fallbackResponse
   }
   try {
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${expression.replace(/\^/g, "**")})`)()
      if(typeof value !== "number" || !isFinite(value)){
         return fallbackResponse
      }
      const rounded = Math.round(value * 1e6) / 1e6 // trim long floating point tails
      return `${expression} is ${rounded}`
   } catch (e) {
      return fallbackResponse
   }
}

// every intent the assistant is allowed to return - anything else is treated as "didn't understand"
const knownTypes = new Set([
   "general","google_search","youtube_search","youtube_play",
   "maps_search","maps_directions","weather_show","calculator_open",
   "instagram_open","facebook_open","whatsapp_open","linkedin_open",
   "github_open","spotify_open","gmail_open","calendar_open",
   "notes_open","settings_open","browser_open",
   "get_time","get_date","get_day","get_month",
   "open_camera","open_gallery","open_files","open_downloads",
   "open_documents","open_desktop","open_terminal",
])

export const askToAssistant=async (req,res)=>{
   try {
      const {command}=req.body
      if(!command || typeof command !== "string" || !command.trim()){
         return res.status(400).json({ response: "I didn't catch that, please try again." })
      }
      if(command.length > 500){
         return res.status(400).json({ response: "That command is too long." })
      }
      const user=await User.findById(req.userId);
      if(!user) {
         return res.status(404).json({ response: "User not found" })
      }
      user.history.push(command)
      await user.save()
      const userName=user.name || "User"
      const assistantName=user.assistantName || "Assistant"
      let result;
      try {
         result = await geminiResponse(command,assistantName,userName)
      } catch (error) {
         const status = error.response?.status
         console.log("Gemini request failed:", status, error.response?.data || error.message)
         if(status === 429){
            return res.status(429).json({ response: "The AI service is rate-limited right now, please wait a moment and try again." })
         }
         if(status === 404){
            return res.status(500).json({ response: "The configured AI model isn't available, please check GEMINI_API_URL in your .env." })
         }
         return res.status(500).json({ response: "Sorry, I am having trouble connecting to AI service right now. Please check Gemini API key." })
      }

      const jsonMatch=result.match(/{[\s\S]*}/)
      if(!jsonMatch){
         return res.status(400).json({response:"sorry, i can't understand"})
      }
      let gemResult;
      try {
         gemResult=JSON.parse(jsonMatch[0])
      } catch (parseErr) {
         return res.status(400).json({response:"sorry, i can't understand"})
      }
      console.log(gemResult)
      const type=gemResult.type

      if(!knownTypes.has(type)){
         return res.status(400).json({ response: "I didn't understand that command." })
      }

      const response = dateTimeResponses[type]
         ? dateTimeResponses[type]()
         : type === "calculator_open"
         ? solveCalculatorExpression(gemResult.userinput, gemResult.response)
         : gemResult.response

      // for these intents, actually go find the real thing instead of guessing a link -
      // if the lookup fails (no API key configured, nothing found, network hiccup) we
      // report resolved:false and the frontend's old search/redirect behavior kicks in
      let resolved = null
      let weatherResolved = false
      let finalResponse = response
      if(type === "youtube_play" && gemResult.userinput){
         resolved = await resolveYoutubeVideo(gemResult.userinput)
         if(resolved) finalResponse = `Playing ${resolved.title}.`
      } else if(type === "spotify_open" && gemResult.userinput){
         resolved = await resolveSpotifyTrack(gemResult.userinput)
         if(resolved) finalResponse = `Playing ${resolved.title} on Spotify.`
      } else if(type === "weather_show" && gemResult.userinput){
         const weather = await resolveWeather(gemResult.userinput)
         if(weather){
            finalResponse = weather.response
            weatherResolved = true
         }
      } else if(type === "github_open" && gemResult.userinput && !/\s/.test(gemResult.userinput)){
         resolved = await resolveGithubUser(gemResult.userinput)
      }

      return res.json({
         type,
         userinput: gemResult.userinput,
         response: finalResponse,
         targetUrl: resolved?.url || null,
         resolved: Boolean(resolved) || weatherResolved,
      })

   } catch (error) {
  return res.status(500).json({ response: "ask assistant error" })
   }
}
