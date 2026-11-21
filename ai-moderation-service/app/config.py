import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))
CLIP_DIR = DATA_DIR / "clips"
DB_PATH = DATA_DIR / "test.db"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CLIP_DIR.mkdir(parents=True, exist_ok=True)


ENV_FILE = ROOT / ".env"
ENV_FOUND = ENV_FILE.exists()


def _load_dotenv():
    env = ENV_FILE
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        line = line.split("#", 1)[0].strip() if not line.strip().startswith("#") else ""
        if "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()


def _f(name, default):
    return float(os.getenv(name, default))


SAMPLE_RATE = 16000
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "large-v3-turbo")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")
WHISPER_THREADS = int(os.getenv("WHISPER_THREADS", "4"))
LANG_MODE = os.getenv("LANG_MODE", "auto")
ASR_BACKEND = os.getenv("ASR_BACKEND", "whisper")
MIN_SILENCE_MS = int(os.getenv("MIN_SILENCE_MS", "900"))   # pause that ends a sentence
VAD_KIND = os.getenv("VAD", "silero")        # silero | energy (energy is for tests with synthetic audio)
ALERT_THRESHOLD = _f("ALERT_THRESHOLD", 0.75)
CLIP_TOTAL_S = _f("CLIP_TOTAL_S", 15)
CLIP_MIN_PAD_S = _f("CLIP_MIN_PAD_S", 3)
COOLDOWN_S = _f("COOLDOWN_S", 30)
STORE_ALL_TRANSCRIPTS = os.getenv("STORE_ALL_TRANSCRIPTS", "1") == "1"
RING_SECONDS = int(os.getenv("RING_SECONDS", "300"))   # audio kept per speaker for clips (about 10 MB each)
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
LMS_API_URL = os.getenv("LMS_API_URL", "http://localhost:8080")
LMS_WEBHOOK_SECRET = os.getenv("LMS_WEBHOOK_SECRET", "qalms_ai_webhook_secret_key")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8000")


def describe():
    src = f"{ENV_FILE}" if ENV_FOUND else f"{ENV_FILE} NOT FOUND, using defaults"
    return (f"settings file: {src}\n"
            f"speech model: {WHISPER_MODEL}  device: {WHISPER_DEVICE}  compute: {WHISPER_COMPUTE}  "
            f"language: {LANG_MODE}  alert threshold: {ALERT_THRESHOLD}")
