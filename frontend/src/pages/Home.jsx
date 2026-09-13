import React, { useContext, useEffect, useRef, useState } from 'react'
import { userDataContext } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import aiImg from "../assets/ai.gif"
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import userImg from "../assets/user.gif"
function Home() {
  const {userData,serverUrl,setUserData,getGeminiResponse}=useContext(userDataContext)
  const navigate=useNavigate()
  const [listening,setListening]=useState(false)
  const [userText,setUserText]=useState("")
  const [aiText,setAiText]=useState("")
  const isSpeakingRef=useRef(false)
  const recognitionRef=useRef(null)
  const [ham,setHam]=useState(false)
  const isRecognizingRef=useRef(false)
  const synth=window.speechSynthesis

  const handleLogOut=async ()=>{
    try {
      const result=await axios.get(`${serverUrl}/api/auth/logout`,{withCredentials:true})
      setUserData(null)
      navigate("/signin")
    } catch (error) {
      setUserData(null)
      console.log(error)
    }
  }

  const startRecognition = () => {
    
   if (!isSpeakingRef.current && !isRecognizingRef.current) {
    try {
      recognitionRef.current?.start();
      console.log("Recognition requested to start");
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        console.error("Start error:", error);
      }
    }
  }
    
  }

  const speak=(text)=>{
    const utterence=new SpeechSynthesisUtterance(text)
    utterence.lang = 'hi-IN';
    const voices =window.speechSynthesis.getVoices()
    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) {
      utterence.voice = hindiVoice;
    }


    isSpeakingRef.current=true
    utterence.onend=()=>{
        setAiText("");
  isSpeakingRef.current = false;
  setTimeout(() => {
    startRecognition(); // ⏳ Delay se race condition avoid hoti hai
  }, 300);
    }
   synth.cancel(); // 🛑 pehle se koi speech ho to band karo
synth.speak(utterence);
  }

  // maps each intent to the URL it should open; "q" is the encoded userinput
  // common site names Gemini might hand back for browser_open, mapped to their real domain
  const knownSites = {
    youtube: "https://www.youtube.com/",
    amazon: "https://www.amazon.com/",
    netflix: "https://www.netflix.com/",
    chatgpt: "https://chat.openai.com/",
    openai: "https://openai.com/",
    google: "https://www.google.com/",
    twitter: "https://twitter.com/",
    x: "https://x.com/",
    reddit: "https://www.reddit.com/",
    wikipedia: "https://www.wikipedia.org/",
  }

  // for these, a single word with no spaces looks like an @handle - go straight to the
  // profile. Anything with spaces is a full name/description, so search for it instead
  // of guessing a wrong handle.
  const profileSite = (base, searchFallback) => (q, raw) => {
    const name = (raw || "").trim()
    if (!name) return base
    if (!/\s/.test(name)) return `${base}${encodeURIComponent(name)}`
    return searchFallback(q)
  }

  const intentUrlMap = {
    google_search: (q) => `https://www.google.com/search?q=${q}`,
    youtube_search: (q) => `https://www.youtube.com/results?search_query=${q}`,
    youtube_play: (q) => `https://www.youtube.com/results?search_query=${q}`,
    maps_search: (q) => `https://www.google.com/maps/search/${q}`,
    maps_directions: (q) => `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    weather_show: (q) => `https://www.google.com/search?q=weather${q ? `+${q}` : ""}`,
    // calculator_open is intentionally absent - the answer is spoken, no tab needed
    instagram_open: profileSite("https://www.instagram.com/", (q) => `https://www.google.com/search?q=${q}+instagram`),
    facebook_open: profileSite("https://www.facebook.com/", (q) => `https://www.google.com/search?q=${q}+facebook`),
    whatsapp_open: () => `https://web.whatsapp.com/`,
    linkedin_open: profileSite("https://www.linkedin.com/in/", (q) => `https://www.google.com/search?q=${q}+linkedin`),
    github_open: profileSite("https://github.com/", (q) => `https://www.google.com/search?q=${q}+github`),
    spotify_open: (q) => (q ? `https://open.spotify.com/search/${q}` : `https://open.spotify.com/`),
    gmail_open: () => `https://mail.google.com/`,
    calendar_open: () => `https://calendar.google.com/`,
    notes_open: () => `https://keep.google.com/`,
    browser_open: (q, raw) => {
      if (raw?.startsWith("http")) return raw
      const key = (raw || "").trim().toLowerCase()
      if (knownSites[key]) return knownSites[key]
      return `https://www.google.com/search?q=${q}`
    },
  }

  // intents where an empty extraction should fall back to the raw sentence rather than
  // opening a blank search/profile page
  const fallsBackToRawTranscript = new Set([
    "google_search","youtube_search","youtube_play","maps_search","maps_directions",
    "instagram_open","facebook_open","linkedin_open","github_open","spotify_open","browser_open",
  ])

  const handleCommand=(data, rawTranscript="")=>{
    if (!data) return;
    const {type,userinput,response,targetUrl,resolved}=data
    if (response) {
      speak(response);
    }

    // the backend actually found the real video/track/profile - go straight there,
    // no guessing needed
    if (targetUrl) {
      window.open(targetUrl, '_blank');
      return;
    }
    // weather already got real numbers spoken - no need to also open a search tab
    if (type === "weather_show" && resolved) {
      return;
    }

    const buildUrl = intentUrlMap[type]
    if (buildUrl) {
      let effectiveInput = userinput
      if (!effectiveInput && fallsBackToRawTranscript.has(type)) {
        // strip the wake word out of the raw sentence as a last-resort query
        const assistantName = userData?.assistantName?.trim().toLowerCase() || ""
        effectiveInput = rawTranscript.toLowerCase().replace(assistantName, "").trim()
      }
      const query = encodeURIComponent(effectiveInput || "")
      window.open(buildUrl(query, effectiveInput), '_blank');
    }
    // system-only intents (open_camera, open_files, open_terminal, etc.) have no
    // web equivalent, so the assistant just speaks the response for those.
  }

useEffect(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = true;
  recognition.lang = 'en-US';
  recognition.interimResults = true; // live partial transcript = faster perceived response

  recognitionRef.current = recognition;

  let isMounted = true;  // flag to avoid setState on unmounted component

  // Start recognition shortly after mount, only if component still mounted
  const startTimeout = setTimeout(() => {
    if (isMounted && !isSpeakingRef.current && !isRecognizingRef.current) {
      try {
        recognition.start();
        console.log("Recognition requested to start");
      } catch (e) {
        if (e.name !== "InvalidStateError") {
          console.error(e);
        }
      }
    }
  }, 400);

  recognition.onstart = () => {
    isRecognizingRef.current = true;
    setListening(true);
  };

  recognition.onend = () => {
    isRecognizingRef.current = false;
    setListening(false);
    if (isMounted && !isSpeakingRef.current) {
      setTimeout(() => {
        if (isMounted) {
          try {
            recognition.start();
            console.log("Recognition restarted");
          } catch (e) {
            if (e.name !== "InvalidStateError") console.error(e);
          }
        }
      }, 300);
    }
  };

  recognition.onerror = (event) => {
    console.warn("Recognition error:", event.error);
    isRecognizingRef.current = false;
    setListening(false);
    if (event.error !== "aborted" && isMounted && !isSpeakingRef.current) {
      setTimeout(() => {
        if (isMounted) {
          try {
            recognition.start();
            console.log("Recognition restarted after error");
          } catch (e) {
            if (e.name !== "InvalidStateError") console.error(e);
          }
        }
      }, 300);
    }
  };

  recognition.onresult = async (e) => {
    let finalTranscript = "";
    let interimTranscript = "";
    // scan every result from the point the engine last reported, not just the last one,
    // so a wake word spoken early in a longer utterance is never missed
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += chunk;
      else interimTranscript += chunk;
    }

    // live captions while the user is still talking = faster, more responsive feel
    if (interimTranscript) setUserText(interimTranscript.trim());

    const transcript = finalTranscript.trim();
    if (!transcript) return;

    const assistantName = userData?.assistantName?.trim().toLowerCase();
    if (assistantName && transcript.toLowerCase().includes(assistantName)) {
      setAiText("");
      setUserText(transcript);
      recognition.stop();
      isRecognizingRef.current = false;
      setListening(false);
      const data = await getGeminiResponse(transcript);
      if (data) {
        handleCommand(data, transcript);
        setAiText(data.response || "");
      }
      setUserText("");
    }
  };


    const greeting = new SpeechSynthesisUtterance(`Hello ${userData.name}, what can I help you with?`);
    greeting.lang = 'hi-IN';
   
    window.speechSynthesis.speak(greeting);
 

  return () => {
    isMounted = false;
    clearTimeout(startTimeout);
    recognition.stop();
    setListening(false);
    isRecognizingRef.current = false;
  };
}, []);




  return (
    <div className='w-full h-[100vh] bg-gradient-to-t from-[black] to-[#02023d] flex justify-center items-center flex-col gap-[15px] overflow-hidden'>
      <CgMenuRight className='lg:hidden text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={()=>setHam(true)}/>
      <div className={`absolute lg:hidden top-0 w-full h-full bg-[#00000053] backdrop-blur-lg p-[20px] flex flex-col gap-[20px] items-start ${ham?"translate-x-0":"translate-x-full"} transition-transform`}>
 <RxCross1 className=' text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={()=>setHam(false)}/>
 <button className='min-w-[150px] h-[60px]  text-black font-semibold   bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
      <button className='min-w-[150px] h-[60px]  text-black font-semibold  bg-white  rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] ' onClick={()=>navigate("/customize")}>Customize your Assistant</button>

<div className='w-full h-[2px] bg-gray-400'></div>
<h1 className='text-white font-semibold text-[19px]'>History</h1>

<div className='w-full h-[400px] gap-[20px] overflow-y-auto flex flex-col truncate'>
  {userData.history?.map((his)=>(
    <div className='text-gray-200 text-[18px] w-full h-[30px]  '>{his}</div>
  ))}

</div>

      </div>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold absolute hidden lg:block top-[20px] right-[20px]  bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold  bg-white absolute top-[100px] right-[20px] rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] hidden lg:block ' onClick={()=>navigate("/customize")}>Customize your Assistant</button>
      <div className='w-[300px] h-[400px] flex justify-center items-center overflow-hidden rounded-4xl shadow-lg'>
<img src={userData?.assistantImage} alt="" className='h-full object-cover'/>
      </div>
      <h1 className='text-white text-[18px] font-semibold flex items-center gap-[8px]'>
        I'm {userData?.assistantName}
        {listening && <span className='w-[10px] h-[10px] rounded-full bg-green-400 animate-pulse' title="Listening"></span>}
      </h1>
      {!aiText && <img src={userImg} alt="" className='w-[200px]'/>}
      {aiText && <img src={aiImg} alt="" className='w-[200px]'/>}
    
    <h1 className='text-white text-[18px] font-semibold text-wrap'>{userText?userText:aiText?aiText:null}</h1>
      
    </div>
  )
}

export default Home