import axios from 'axios'
import React, { createContext, useEffect, useState } from 'react'
export const userDataContext=createContext()
function UserContext({children}) {
    const serverUrl=import.meta.env.VITE_SERVER_URL || "http://localhost:8000"
    const [userData,setUserData]=useState(null)
    const [frontendImage,setFrontendImage]=useState(null)
     const [backendImage,setBackendImage]=useState(null)
     const [selectedImage,setSelectedImage]=useState(null)
    const handleCurrentUser=async ()=>{
        try {
            const result=await axios.get(`${serverUrl}/api/user/current`,{withCredentials:true})
            setUserData(result.data)
            console.log(result.data)
        } catch (error) {
            console.log(error)
        }
    }

    const getGeminiResponse=async (command)=>{
try {
  const result=await axios.post(`${serverUrl}/api/user/asktoassistant`,{command},{withCredentials:true})
  return result.data
} catch (error) {
  console.error("getGeminiResponse failed:", error)
  if(error.response){
    // request reached the backend, backend rejected it
    if(error.response.status === 400 || error.response.status === 401){
      return { type:"error", userinput:"", response: "Please log in again, your session seems to have expired." }
    }
    if(error.response.status === 429){
      return { type:"error", userinput:"", response: error.response.data?.response || "Too many requests, please slow down a little." }
    }
    return { type:"error", userinput:"", response: error.response.data?.response || error.response.data?.message || "Something went wrong, please try again." }
  }
  // no error.response means the request never got a reply at all - almost always CORS or the
  // backend being unreachable (wrong VITE_SERVER_URL, backend not running, FRONTEND_URL mismatch)
  return { type:"error", userinput:"", response: "I couldn't reach the server. Please check your connection and try again." }
}
    }

    useEffect(()=>{
handleCurrentUser()
    },[])
    const value={
serverUrl,userData,setUserData,backendImage,setBackendImage,frontendImage,setFrontendImage,selectedImage,setSelectedImage,getGeminiResponse
    }
  return (
    <div>
    <userDataContext.Provider value={value}>
      {children}
      </userDataContext.Provider>
    </div>
  )
}

export default UserContext
