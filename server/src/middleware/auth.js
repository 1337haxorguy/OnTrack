const SUPABASE_URL = process.env.SUPABASE_URL;

// Lazily load jose (pure ESM) and cache the JWKS set
let _jwtVerify;
let _JWKS;

async function initJose() {
  if (_jwtVerify) return;
  const jose = await import("jose");
  _jwtVerify = jose.jwtVerify;
  _JWKS = jose.createRemoteJWKSet(
    new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
  );
}

const jwtCheck = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.slice(7);
  try {
    await initJose();
    const { payload } = await _jwtVerify(token, _JWKS, {
      audience: "authenticated",
    });
    req.auth = { payload };
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Sets req.auth if a valid token is present, but never rejects the request.
// Used on endpoints that work for both authenticated and guest users.
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();
  const token = authHeader.slice(7);
  try {
    await initJose();
    const { payload } = await _jwtVerify(token, _JWKS, { audience: "authenticated" });
    req.auth = { payload };
  } catch {
    // Invalid or expired token — treat as unauthenticated, still proceed.
  }
  next();
};

module.exports = { jwtCheck, optionalAuth };
