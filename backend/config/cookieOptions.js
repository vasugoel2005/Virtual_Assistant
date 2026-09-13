const isProd = process.env.NODE_ENV === "production"

// in production (real HTTPS domains) the cookie must be secure + cross-site (none);
// in local dev over http, secure cookies get silently dropped by the browser
const cookieOptions = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
}

export default cookieOptions
