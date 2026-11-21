"""Make robotic test speech with espeak-ng (English or Urdu voice). For pipeline tests only:
robot voices say nothing about real accuracy.   python tools/make_test_audio.py out.wav "text" [voice]"""
import subprocess
import sys
import tempfile
import os


def speak(path, text, voice="en"):
    tmp = tempfile.mktemp(suffix=".wav")
    subprocess.run(["espeak-ng", "-v", voice, "-s", "150", "-w", tmp, text], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", path], check=True)
    os.unlink(tmp)


if __name__ == "__main__":
    speak(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "en")
