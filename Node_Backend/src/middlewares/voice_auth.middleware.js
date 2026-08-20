import { ApiError } from "../utils/ApiError.js";

/**
 * Verifies x-voice-key header for internal Python agent → Node.js calls.
 * Set VOICE_INTERNAL_KEY in .env. If unset in non-production, requests pass
 * without a key (dev convenience). In production, key is always required.
 */
export const verifyVoiceKey = (req, _res, next) => {
  const envKey = process.env.VOICE_INTERNAL_KEY;

  if (!envKey) {
    if (process.env.NODE_ENV === "production") {
      return next(new ApiError(500, "VOICE_INTERNAL_KEY not configured on server"));
    }
    // Dev mode — skip key check if env var not set
    return next();
  }

  const provided = req.headers["x-voice-key"];
  if (!provided || provided !== envKey) {
    return next(new ApiError(401, "Invalid or missing voice API key"));
  }
  next();
};
