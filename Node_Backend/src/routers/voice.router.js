import { Router }                                        from "express";
import { getVoiceMenu, getVoiceRecommendations, placeVoiceOrder } from "../controllers/voice.controller.js";
import { verifyVoiceKey }                               from "../middlewares/voice_auth.middleware.js";

const router = Router();

// All voice routes require the internal API key (x-voice-key header)
router.use(verifyVoiceKey);

router.get ("/menu",            getVoiceMenu);
router.post("/recommendations", getVoiceRecommendations);
router.post("/orders",          placeVoiceOrder);

export default router;
