"""Simulated participant: joins a room and streams a 16 kHz mono WAV in real time.

  python tools/sim_client.py --name Ali --role student --wav speech.wav [--lead 5] [--tail 12]
Used for repeatable tests with recorded audio, and for load tests with many streams.
"""
import argparse
import asyncio
import json
import wave

import numpy as np
import websockets

CHUNK = 1600  # 100 ms


def read_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2, "need 16 kHz mono 16-bit"
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")


async def run(url, name, role, room, pcm, chat=None):
    async with websockets.connect(url, max_size=None) as ws:
        await ws.send(json.dumps({"type": "join", "name": name, "role": role, "room": room}))
        await ws.recv()
        loop = asyncio.get_running_loop()
        t0 = loop.time()
        for i in range(0, len(pcm), CHUNK):
            chunk = pcm[i:i + CHUNK]
            if len(chunk) < CHUNK:
                chunk = np.pad(chunk, (0, CHUNK - len(chunk)))
            await ws.send(chunk.astype("<i2").tobytes())
            if chat:
                for at, text in list(chat):
                    if i / 16000 >= at:
                        await ws.send(json.dumps({"type": "chat", "text": text}))
                        chat.remove((at, text))
            delay = t0 + (i + CHUNK) / 16000 - loop.time()
            if delay > 0:
                await asyncio.sleep(delay)
        return loop.time() - t0


def build(wav, lead, tail):
    sp = read_wav(wav) if wav else np.zeros(0, dtype=np.int16)
    return np.concatenate([np.zeros(int(lead * 16000), dtype=np.int16), sp, np.zeros(int(tail * 16000), dtype=np.int16)])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="ws://127.0.0.1:8000/ws/room")
    ap.add_argument("--name", default="Sim")
    ap.add_argument("--role", default="student")
    ap.add_argument("--room", default="class-1")
    ap.add_argument("--wav")
    ap.add_argument("--lead", type=float, default=3)
    ap.add_argument("--tail", type=float, default=10)
    a = ap.parse_args()
    print("streamed", round(asyncio.run(run(a.url, a.name, a.role, a.room, build(a.wav, a.lead, a.tail))), 1), "s")
