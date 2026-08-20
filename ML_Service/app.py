# ─────────────────────────────────────────────────────────────────────────────
# app.py — FastAPI ML Inference Service
#
# Startup: loads all models into memory via lifespan context manager
# Routes:  GET  /health
#          POST /engine1/price
#          POST /engine2/upsell
#          POST /engine3/optimize
# ─────────────────────────────────────────────────────────────────────────────
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is on sys.path so absolute imports work
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import SERVICE_HOST, SERVICE_PORT, CORS_ORIGINS
from models.model_loader import model_store
from routes.engine1_routes import router as engine1_router
from routes.engine2_routes import router as engine2_router
from routes.engine3_routes import router as engine3_router

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)s │ %(levelname)s │ %(message)s",
)
logger = logging.getLogger("ml_service")


# ── Lifespan — load models once on startup ───────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ML Service — loading models …")
    model_store.load_all()
    logger.info(f"ML Service ready on {SERVICE_HOST}:{SERVICE_PORT}")
    yield
    logger.info("ML Service shutting down")


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HackaMined ML Inference Service",
    version="1.0.0",
    description="Restaurant Revenue Intelligence — 3-engine ML inference API",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Engine routes ────────────────────────────────────────────────────────────
app.include_router(engine1_router)
app.include_router(engine2_router)
app.include_router(engine3_router)


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=SERVICE_HOST,
        port=SERVICE_PORT,
        reload=False,
        log_level="info",
    )
