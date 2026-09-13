import axios from "axios"

// ---------- YouTube: find the actual top video and link straight to it ----------
export async function resolveYoutubeVideo(query){
   const apiKey = process.env.YOUTUBE_API_KEY
   if(!apiKey || !query) return null
   try {
      const { data } = await axios.get("https://www.googleapis.com/youtube/v3/search", {
         params: { part: "snippet", q: query, type: "video", maxResults: 1, key: apiKey },
      })
      const videoId = data.items?.[0]?.id?.videoId
      const title = data.items?.[0]?.snippet?.title
      return videoId ? { url: `https://www.youtube.com/watch?v=${videoId}`, title } : null
   } catch (error) {
      console.log("YouTube resolve failed:", error.response?.data?.error?.message || error.message)
      return null
   }
}

// ---------- Spotify: Client Credentials flow (no user login needed) to find the real track ----------
let spotifyTokenCache = { token: null, expiresAt: 0 }

async function getSpotifyToken(){
   if(spotifyTokenCache.token && Date.now() < spotifyTokenCache.expiresAt) return spotifyTokenCache.token
   const clientId = process.env.SPOTIFY_CLIENT_ID
   const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
   if(!clientId || !clientSecret) return null

   const { data } = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
         headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
         },
      }
   )
   spotifyTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
   return spotifyTokenCache.token
}

export async function resolveSpotifyTrack(query){
   if(!query) return null
   try {
      const token = await getSpotifyToken()
      if(!token) return null
      const { data } = await axios.get("https://api.spotify.com/v1/search", {
         params: { q: query, type: "track", limit: 1 },
         headers: { Authorization: `Bearer ${token}` },
      })
      const track = data.tracks?.items?.[0]
      return track ? { url: track.external_urls.spotify, title: `${track.name} - ${track.artists.map(a=>a.name).join(", ")}` } : null
   } catch (error) {
      console.log("Spotify resolve failed:", error.response?.data || error.message)
      return null
   }
}

// ---------- Weather: real numbers via Open-Meteo, which needs no API key at all ----------
const WEATHER_CODES = {
   0: "clear sky", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
   45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
   61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow",
   80: "rain showers", 81: "rain showers", 82: "violent rain showers",
   95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
}

export async function resolveWeather(location){
   if(!location) return null
   try {
      const geo = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
         params: { name: location, count: 1 },
      })
      const place = geo.data.results?.[0]
      if(!place) return null

      const weather = await axios.get("https://api.open-meteo.com/v1/forecast", {
         params: { latitude: place.latitude, longitude: place.longitude, current: "temperature_2m,weather_code" },
      })
      const temp = weather.data.current?.temperature_2m
      const code = weather.data.current?.weather_code
      if(temp === undefined) return null

      const condition = WEATHER_CODES[code] || "unclear conditions"
      return { response: `It's currently ${temp}°C with ${condition} in ${place.name}.` }
   } catch (error) {
      console.log("Weather resolve failed:", error.response?.data || error.message)
      return null
   }
}

// ---------- GitHub: this one's public API needs no key, so we can genuinely verify the profile exists ----------
export async function resolveGithubUser(username){
   if(!username || /\s/.test(username)) return null
   try {
      const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`)
      return { url: data.html_url, name: data.name || data.login }
   } catch (error) {
      return null // 404 just means it wasn't a real username - caller falls back to search
   }
}
