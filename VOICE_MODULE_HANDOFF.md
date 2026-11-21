# Quran Academy AI Monitoring: VOICE Module Handoff

**Status date:** 12 November 2026
**Project stage:** testing phase, in a separate test web app. Nothing has been integrated into the client's platform yet.
**Current version of the test app:** v4 (`voice-test-app-v4.zip`)

This document is written so that another engineer, or another AI model, can continue the work without any earlier conversation. It explains the goal, the hard rules, what has been built, which models are used and why, how to run the app, every test case, the results so far, the known problems, and the next steps.

---

## 1. Goal

The client runs a live online Quran academy (teachers and students, many of them children, in live video classes). They want automatic monitoring of live classes so that the admin is told when someone shares or asks for **personal information**.

The first priority is the **VOICE module**:

* During a live class, if a teacher or a student **shares** personal information (for example their phone number) or **asks for** it ("give me your WhatsApp number"), by **voice or in the chat box**, the system must detect it.
* For voice, it must cut a **15-second audio clip** around the incident (a few seconds before, the incident, a few seconds after) and send it to the admin with the transcript.
* The **admin decides** what to do. The admin manually turns off the user's screen. **The system must never do this automatically.**

Languages: **English and Urdu** first (including Roman Urdu, which is Urdu written in Latin letters, used in chat).

Personal information covered in the first version: phone numbers, WhatsApp / social media IDs (Instagram, Facebook, Snapchat, Telegram, TikTok, IMO, Twitter), email addresses, home addresses, photo requests, and **requests** for any of these.

---

## 2. Hard rules (do not break these)

1. **Do not modify the client's existing project.** All work happens in the separate test app until the test results are reviewed and the integration is approved.
2. **No automatic action against users.** The system only reports to the admin. No automatic screen-off, mute, kick or block.
3. **Test voices only.** Never use real children's voices or real personal details in tests.
4. **Do not promise accuracy that has not been measured.** Accuracy claims must come from the test results, per language.
5. **Secrets.** The client's platform passes the user's login token (`lmsToken`) in the video-room URL. Never log full join URLs. Never paste `.env` values, tokens or `recovered_envs/` content anywhere.
6. **Licences.** The client's video-call app is a fork of MiroTalk SFU, licensed **AGPL-3.0**. Keep the moderation service as a separate process and repository, connected only through network calls (RTP/HTTP), so it is not pulled under the AGPL.
7. **Prefer free, open-source models with commercial-use licences.** No paid AI APIs.

---

## 3. The client's existing platform (facts from their DEVELOPER_GUIDE)

The client's code is not available to us. These facts come from the developer guide they shared:

* **Backend:** Node.js + Express 4, Sequelize 6, MySQL 8, Socket.IO 4 (path `/chat/socket.io/`), node-cron, PM2, pnpm. It must run as a single instance (in-memory presence and cron deduplication).
* **Portal frontend:** Next.js 16, React 19, TypeScript, Ant Design 5, Redux Toolkit (`admin/`, port 3001).
* **Video calls:** `calling-app/`, a fork of **MiroTalk SFU v1.4.80**, using **mediasoup 3**, running in Docker with host networking, UDP ports 40000–40100, port 3010. It is embedded in the portal through an **iframe**.
* **Join URL parameters:** `room`, `name`, `isPresenter`, `lmsSessionId`, `lmsCourseId`, `lmsToken` (the user's JWT), `lmsApiUrl`, `lmsUserRole` (`teacher` / `student` / `admin`), `lmsProfileImage`.
* **Server-to-server secret:** `CALLING_APP_API_SECRET`, shared between the backend and the calling app. `calling-app/app/src/config.js` has a hard-coded fallback secret, so it must always be set explicitly.
* **Existing transcript hook:** `public/js/WhisperRecorder.js` uses the **Google Web Speech API** in the browser, and runs only for teacher and admin, never for students. **Not suitable for reuse:** it misses student speech, it is weak for Urdu, and it can be tampered with.
* **Two separate chats:** the LMS chat (Socket.IO on the backend: `chatMessage`, `privateMessage`, `groupMessage`) and possibly MiroTalk's built-in in-room chat. The guide does not say which one is used during live classes. **Open question for the client.**
* **Voice notes** exist in the LMS chat (`/api/chat/upload-voice`). Out of scope for now.
* **Hosting:** Contabo VPS, nginx, Let's Encrypt, GitHub Actions. The server runs on PKT time; session times are stored as date strings.
* **No existing server-side audio recording.** Clip capture is new work.

---

## 4. Decisions taken so far

| Decision | Choice | Reason |
|---|---|---|
| Where the AI runs | The client's own server CPU/GPU (production). The test runs first on the developer's laptop, CPU only. | Client decision. Laptop first for quick functional tests. |
| Audio path in the test app | Browser to server over WebSocket first. A mediasoup audio tap comes later. | Fastest way to prove detection, clips and admin review. mediasoup matches production and is the next integration step. |
| PII types, first version | Phone, WhatsApp/social IDs, email, home address, photo requests, and requests for any of these | User selection |
| Chat box | The test app has its own chat box, checked with the same rules | User request |
| Admin action | Report only, manual action by the admin | Client requirement |
| Detection approach | Speech-to-text, then rules over the text. No AI model for the detection step yet. | Rules are precise, explainable and need no training data. An ML classifier can be added later if the measured recall is too low. |

---

## 5. Models and libraries

### 5.1 Used in the test app

| Component | Model / library | Licence | Role |
|---|---|---|---|
| Speech-to-text | **faster-whisper 1.2.1** (CTranslate2 engine) | MIT | Runs Whisper models fast on CPU and GPU |
| Speech model, Urdu + English | **Whisper `large-v3-turbo`** (via `mobiuslabsgmbh/faster-whisper-large-v3-turbo`) | MIT | Default model. Needed for Urdu. About 1.5 GB. |
| Speech model, quick English test | **Whisper `small.en`** (`Systran/faster-whisper-small.en`) | MIT | English only, fast on a laptop CPU. Unusable for Urdu. |
| Speech model, best accuracy | Whisper `large-v3` | MIT | Optional on a GPU server. Slower. |
| Voice activity detection | **Silero VAD v6** (ONNX file bundled inside faster-whisper) | MIT | Finds where speech starts and ends; cuts the stream into sentences |
| ONNX runtime | onnxruntime | MIT | Runs Silero VAD |
| Phone number validation | **phonenumbers** (Python port of Google libphonenumber) | Apache-2.0 | Checks if digits form a valid Pakistani / international number |
| Web server | FastAPI + Uvicorn | MIT / BSD | Pages, REST API, WebSockets |
| Storage | SQLite (Python standard library) | Public domain | Alerts, transcripts, chat log |
| Self-signed HTTPS | cryptography | Apache-2.0 / BSD | Optional HTTPS for microphone access from other devices |
| Browser audio capture | Web Audio API, AudioWorklet | Browser built-in | Microphone to 16 kHz mono PCM |

### 5.2 Known accuracy facts (from published research, not measured by us)

* Whisper `large-v3` on Urdu: about **21% word error rate** (conversational speech about 18%).
* Whisper `tiny` / `base` / `small` on Urdu: unusable (above 100% WER on conversational speech).
* Rare words (slurs, names) are recognised much worse than common words.
* Whisper can invent text ("hallucinate") on silence, music or melodic audio, and **Quran recitation** is a major risk: language detection flips between Arabic and Urdu.
* Zero-shot LLMs scored only 0.23–0.51 macro-F1 on Urdu abusive-language detection versus 0.88 for a fine-tuned encoder (arXiv 2405.15453). LLMs should only be a second-stage check, never the first filter.

### 5.3 Rejected on licence grounds

SeamlessM4T and MMS (CC-BY-NC, non-commercial), Ultralytics YOLO and NudeNet (AGPL), YOLO-NAS (non-commercial), InsightFace weights (non-commercial), Ministral-8B (research licence), Piiranha (CC-BY-NC-ND), Hurtlex (CC BY-NC-SA), Perspective API (shutting down).

### 5.4 Candidates for later phases (not used yet)

* **MuRIL** (`google/muril-base-cased`, Apache-2.0): fine-tune as a text classifier for Urdu / Roman Urdu if rules miss too much.
* **Detoxify** (Apache-2.0): English abuse detection (for the abusive-language part, later).
* **Qwen3-8B** (Apache-2.0): optional second-stage check on borderline alerts only.

---

## 6. How the test app works

### 6.1 Pipeline

```
Browser microphone (AudioWorklet, 16 kHz mono, 100 ms blocks, muted = silence)
  -> WebSocket /ws/room
  -> per-speaker ring buffer (300 s of audio kept)
  -> Silero VAD segmenter (sentence ends after 0.9 s of silence, max 12 s)
  -> audio copied and queued (one speech-model worker)
  -> faster-whisper transcribe (word timestamps, greedy decoding, no previous-text conditioning)
  -> PII rules over the last 8 seconds of words (so numbers spoken in pieces join up)
  -> confidence >= 0.75 ? alert : log only
  -> alert saved + admin notified immediately ("clip being prepared")
  -> clip finalised once the audio after the incident has arrived (about 5-8 s)
  -> admin page plays the 15 s clip, admin marks Real violation / False alarm, Clip right / wrong
```

Chat messages go through the same rules instead of the speech model. Chat alerts carry the previous 5 messages as context, with no clip.

### 6.2 The 15-second clip

* Total length is fixed at 15 s (`CLIP_TOTAL_S`).
* The incident (the flagged words) is **centred**. Padding before and after is `(15 - incident length) / 2`, never less than 3 s (`CLIP_MIN_PAD_S`).
* Short incidents therefore get about 5–7 s on each side, more than the 3–4 s first described. An incident longer than 9 s is cut to its first 9 s and flagged "truncated".
* **Stereo:** the left channel is the flagged speaker; the right channel is everyone else in the class, aligned by wall clock. The admin page also offers a "mixed to both ears" version.
* SHA-256 hash stored for each clip.
* Missing audio (speaker left early) is filled with silence and reported on the alert.

### 6.3 Detection rules (`app/pii/detect.py`)

Text is normalised first: Urdu letter variants unified, diacritics removed, Arabic-Indic digits converted, lower case. Rules then look for:

* **Phone shares:** digit runs, typed or spoken as words in English, Urdu or Roman Urdu ("zero three double zero ...", "صفر تین ...", "zero teen ..."). Misheard digits ("to", "for", "tree") count only inside a run with at least 3 real digits. Validated with `phonenumbers`:
  * valid Pakistani mobile: 0.95
  * valid international mobile: 0.90
  * 10+ digits with a phone word nearby ("number", "WhatsApp", "call"): 0.80
  * 10–13 digits alone: 0.76
  * 7–9 digits with a phone word: 0.78
  * counting sequences (1234567) are ignored.
* **Email shares:** typed addresses (0.95), spoken "name at gmail dot com" / "at the rate" / "ایٹ جی میل" (0.90).
* **Social shares:** `@handle` (0.80), "my instagram id is ..." (0.80), "add me on snapchat" / "mujhe insta pe add karo" (0.78).
* **Address shares:** house/flat/plot number plus street/sector/block/gali (0.88), "my address is ..." (0.85), "I live near ... market" (0.78).
* **Requests:** possessive ("your", "apna", "آپ کا", ...) plus noun (phone, number, WhatsApp, email, address, photo, Instagram, ...) plus a request verb. English verbs must come before the noun ("give me your number"); Urdu and Roman Urdu verbs after it ("apna number do").
  * A bare "your number" alerts only with a strong verb (give, send, share, do, dein, bhejo) and **never** when class words are nearby (page, ayah, surah, lesson, roll, sabaq, safha, صفحہ, آیت, سبق, ...).
  * "Tell me your number" / "اپنا نمبر بتاؤ" are **deliberately not alerted** (0.50, logged only): in a class this usually means a roll number.
* **Alert threshold:** 0.75 (`ALERT_THRESHOLD`). Anything lower is logged in the transcript but raises no alert.
* **Cooldown:** one alert per speaker and PII type within `COOLDOWN_S` seconds (default 30); repeats are merged into the earlier alert as "repeat(s) merged". **Set to 0 during testing** so every line gets its own alert.
* **Recitation gate:** if Whisper's language detection gives Arabic at 0.7 or more (`ARABIC_GATE`), the sentence is skipped as likely Quran recitation. It is shown as "not used: recitation_suspect" so wrongly skipped Urdu is visible. Only applies when `LANG_MODE=auto`.
* **Near-silence** sentences are skipped without calling the model, to prevent invented text.

---

## 7. Files in the test app

```
voice-test-app/
  run.py                  start the app (python run.py [--https] [--lan])
  requirements.txt        Python packages
  .env.example            settings template (copy to .env)
  Dockerfile, docker-compose.yml   for the GPU server later
  README.md               user guide and change log
  app/
    config.py             settings, read from .env
    main.py               FastAPI app: pages, WebSockets, REST API, test results
    engine.py             audio in, alerts and clips out
    store.py              SQLite storage
    audio/ringbuffer.py   per-speaker audio buffer
    audio/segmenter.py    Silero VAD streaming segmenter
    audio/transcriber.py  faster-whisper wrapper (+ scripted transcriber for tests)
    audio/clipper.py      15 s window and stereo WAV writer
    pii/normalize.py      text normalisation
    pii/numbers.py        digit runs, spoken digits
    pii/detect.py         all detection rules
    static/               index.html + room.js (test room), admin.html + admin.js (review), worklet.js (microphone)
  eval/
    text_cases.jsonl      146 labelled text lines (written together with the rules)
    unseen_cases.json     88 labelled lines written after the rules, never used for tuning
    live_cases.json       36 guided test lines used in the room page
    run_text_eval.py      python eval/run_text_eval.py [--unseen]
  tests/                  pytest unit tests (9)
  tools/
    e2e_check.py          end-to-end check: two simulated speakers, clip verified sample by sample
    e2e_browser.py        real Chromium with a fake microphone
    load_frontend.py      CPU cost of the audio front end for N streams
    sim_client.py         stream any 16 kHz WAV file as a participant
    make_test_audio.py    robot test speech with espeak-ng (pipeline tests only)
```

### REST API and WebSockets

| Endpoint | Purpose |
|---|---|
| `GET /` | Test room page |
| `GET /admin` | Admin review page |
| `WS /ws/room` | Participant: JSON `join`, binary audio (16 kHz Int16 LE), JSON `chat`, `expect` / `clear` (guided test tags) |
| `WS /ws/admin` | Admin live events: `alert`, `alert_update`, `alert_merged`, `utterance`, `engine_error` |
| `GET /api/alerts` | Alert list |
| `POST /api/alerts/{id}/review` | `{status: true_alarm/false_alarm}` or `{clip_ok: 1/0}` |
| `GET /api/clips/{id}` | Clip WAV (`?mono=1` for mixed) |
| `GET /api/utterances` | All transcripts |
| `GET /api/metrics` | Model state, queue, speed, last error |
| `POST /api/text-check` | Check any text against the rules |
| `GET /api/eval/cases`, `GET /api/eval/summary` | Guided test lines and results |
| `POST /api/reset` | Delete all test data |

Optional admin password: `ADMIN_TOKEN` in `.env`, then add `?token=...` to the admin URL.

---

## 8. How to run (Windows laptop)

1. Install Python 3.10 or newer.
2. Unzip, then open the inner `voice-test-app` folder (the one with `run.py`) in VS Code.
3. In the VS Code terminal, run one at a time:
   ```
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   copy .env.example .env
   ```
   If PowerShell blocks the activate step: `Set-ExecutionPolicy -Scope Process Bypass`.
4. Edit `.env` and save:
   * Quick English test on a laptop: `WHISPER_MODEL=small.en` and `LANG_MODE=en`
   * Urdu test (needs a GPU in practice): `WHISPER_MODEL=large-v3-turbo` and `LANG_MODE=auto` (or `ur`)
   * During testing: `COOLDOWN_S=0`
5. Start it with `python run.py`. The first lines print the settings file and the model in use.
6. Wait for `[asr] model ready` (the first run downloads the model).
7. Open `http://localhost:8000/` (room) and `http://localhost:8000/admin` (admin).
8. To update to a new version, unzip it over the old folder with "Replace the files". `.venv` and `.env` are kept.

**Other devices on the same network:** `python run.py --https --lan`, then open `https://<laptop-IP>:8000/`. Browsers allow the microphone only on `localhost` or HTTPS. Set `ADMIN_TOKEN` first, because anyone on the network could otherwise open the admin page. Other networks are not supported (it would need a tunnel; not recommended for this test app).

**GPU server:** `docker compose up --build` with `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE=float16`, and the NVIDIA container toolkit (see the comments in `docker-compose.yml`).

### Settings (`.env`)

| Setting | Default | Meaning |
|---|---|---|
| `WHISPER_MODEL` | `large-v3-turbo` | Speech model |
| `WHISPER_DEVICE` | `auto` | `auto`, `cpu` or `cuda` |
| `WHISPER_COMPUTE` | `int8` | `int8` on CPU, `float16` on GPU |
| `WHISPER_THREADS` | 4 | CPU threads |
| `LANG_MODE` | `auto` | `auto` (English or Urdu per sentence), `en`, `ur` |
| `ALERT_THRESHOLD` | 0.75 | Minimum confidence for an alert |
| `CLIP_TOTAL_S` / `CLIP_MIN_PAD_S` | 15 / 3 | Clip length and minimum padding |
| `COOLDOWN_S` | 30 | One alert per speaker and type in this window (use 0 for testing) |
| `MIN_SILENCE_MS` | 900 | Pause that ends a sentence |
| `ARABIC_GATE` | 0.7 | Skip probable Quran recitation |
| `RING_SECONDS` | 300 | Audio kept per speaker |
| `STORE_ALL_TRANSCRIPTS` | 1 | Keep all transcripts (needed for accuracy measurement) |
| `ADMIN_TOKEN` | empty | Admin password |
| `HOST` / `PORT` | 127.0.0.1 / 8000 | Network address |

---

## 9. How to test

### 9.1 Set-up for a manual test

* Open the admin page and click **Delete all test data**.
* Open the room in **one** tab with **Join with microphone** (role Student or Teacher). Open other participants with **Join chat only**, to avoid several microphones picking up the same voice.
* To test the other role's voice, close the room tabs and swap which one has the microphone.

### 9.2 Guided accuracy test (in the room page)

For each line: press **Start**, say the line naturally, wait 2 seconds, press **Done**, and wait for the "heard" box before the next line. Or press **Send as chat** to test the chat path with the same line. Results appear on the admin page under **Test results**: caught / missed / false alert / correctly quiet per line, precision and recall for voice and chat, median time until the clip is ready, and the clip-correctness count.

**Lines without Start / Done are not counted in Test results.**

For each voice alert, the reviewer also clicks **Real violation** or **False alarm**, and **Clip is right** or **Clip is wrong** after listening.

### 9.3 All guided test lines

18 lines should alert and 18 should not. The "no alert" lines are as important as the others: they measure false alarms. With `small.en`, test only the English lines; Urdu and Roman Urdu need `large-v3-turbo`.

Spoken tips: say digits as words in short groups of 3–4 ("zero three zero zero, one two three, four five six seven"). For L06, say "my instagram is ali underscore khan ninety nine".

| ID | Line to say | Language | Expected |
|---|---|---|---|
| L01 | my number is 0300 1234567 | English | Alert (phone) |
| L02 | my number is zero three double zero nine eight seven six five four three | English | Alert (phone) |
| L03 | میرا نمبر صفر تین صفر صفر ایک دو تین چار پانچ چھ سات ہے | Urdu | Alert (phone) |
| L04 | mera number hai 0300 1234567 | Roman Urdu | Alert (phone) |
| L05 | my email is ali khan at gmail dot com | English | Alert (email) |
| L06 | my instagram is @ali_khan99 | English | Alert (social) |
| L07 | add me on snapchat | English | Alert (social) |
| L08 | I live at house number 45 block C Gulshan colony | English | Alert (address) |
| L09 | give me your number | English | Alert (phone) |
| L10 | what is your phone number | English | Alert (phone) |
| L11 | can I have your whatsapp | English | Alert (phone) |
| L12 | send me your photo | English | Alert (photo) |
| L13 | apna WhatsApp number bhejo | Roman Urdu | Alert (phone) |
| L14 | اپنا واٹس ایپ نمبر بھیجیں | Urdu | Alert (phone) |
| L15 | آپ کا موبائل نمبر کیا ہے | Urdu | Alert (phone) |
| L16 | اپنی تصویر بھیجو | Urdu | Alert (photo) |
| L17 | اپنا پتہ بتاؤ | Urdu | Alert (address) |
| L18 | میرا پتہ یہ ہے مکان نمبر بارہ گلی پانچ | Urdu | Alert (address) |
| L19 | open page number 25 | English | No alert |
| L20 | what is your roll number | English | No alert |
| L21 | read ayah number 255 | English | No alert |
| L22 | do not use your phone during class | English | No alert |
| L23 | send the homework on whatsapp | English | No alert |
| L24 | I live in Lahore | English | No alert |
| L25 | one two three four five six seven | English | No alert |
| L26 | the fee is 15000 rupees per month | English | No alert |
| L27 | صفحہ نمبر پچیس کھولیں | Urdu | No alert |
| L28 | اپنا فون بند کرو | Urdu | No alert |
| L29 | اپنا ہوم ورک بھیجیں | Urdu | No alert |
| L30 | ایک دو تین چار پانچ چھ سات آٹھ نو | Urdu | No alert |
| L31 | sabaq number do likho | Roman Urdu | No alert |
| L32 | apna roll number batao | Roman Urdu | No alert |
| L33 | send me a photo of your notebook | English | No alert |
| L34 | show me your notebook | English | No alert |
| L35 | tell me your number | Mixed | No alert (ambiguous) |
| L36 | اپنا نمبر بتاؤ | Mixed | No alert (ambiguous) |

### 9.4 Further manual test cases (beyond the guided lines)

| # | Scenario | What to check |
|---|---|---|
| M1 | Same line said by 3+ different people (male, female, different accents) | Detection rate per speaker |
| M2 | Fast speech, slow speech, long pauses between digit groups | Numbers still joined into one run |
| M3 | Background noise (fan, TV, other people talking) | False alerts, missed alerts |
| M4 | Teacher and student both with microphones, talking in turn (two devices) | Right speaker flagged, right channel of the clip holds the other person |
| M5 | Teacher asks "give me your number", student answers with a number | Two alerts (request + share), clip context makes sense |
| M6 | Number shared, speaker leaves the room within 2 s | Alert still created, clip flagged "after is missing" |
| M7 | Same number repeated 3 times within 30 s with `COOLDOWN_S=30` | One alert with "repeat(s) merged" |
| M8 | Quran recitation for 1 minute (`LANG_MODE=auto`, `large-v3-turbo`) | No alerts; recitation marked "not used: recitation_suspect" |
| M9 | Urdu conversation mixed with English words | Urdu PII lines detected |
| M10 | Chat: every guided line with **Send as chat** | Chat precision / recall |
| M11 | Chat with spelling variants and typos ("ap ka no. do", "whatsap", "03OO1234567" with letter O) | Robustness |
| M12 | A 10-minute normal class conversation with no PII | Zero alerts; this measures the false-alarm rate per hour |
| M13 | Listen to every clip | Incident audible in the middle, 15 s long |

### 9.5 Automated checks (developer)

```
pytest tests                       # unit tests (9)
python eval/run_text_eval.py       # 146 labelled text lines
python eval/run_text_eval.py --unseen   # 88 lines not used for tuning
python tools/e2e_check.py          # two simulated speakers, clip verified sample by sample
python tools/e2e_browser.py        # real Chromium with fake microphone (needs playwright + chromium)
python tools/load_frontend.py 100 15    # CPU cost of the audio front end for 100 streams
```

The end-to-end checks use a scripted transcriber (fixed text at known times) because the real speech model cannot be downloaded in the development workspace. They prove the audio, clip and alert chain, not speech accuracy.

---

## 10. Results so far

### 10.1 Automated (development workspace)

* Text rules, 146 lines written together with the rules: 0 false alerts, 0 misses. Not independent evidence.
* Text rules, 88 unseen lines: 0 false alerts out of 55 negatives; 31 of 33 positives caught (94%). Misses: "send me a request on instagram", "we live in sector F-10 near the central market".
* Clip: exact speaker audio for the window, 15.00 s, incident centred, other participant aligned within 0.3 s (measured 0–1 ms), clip ready about 5.5–6 s after the words.
* Real Chromium with a fake microphone: audio capture, chat, admin page and guided test all work.
* Audio front end (ring buffer + VAD + segmenter): 100 streams used about 0.37 CPU cores on a 2-core machine. The speech model is the expensive part and was not included.

### 10.2 Live tests on the developer's laptop (12 Nov 2026, Windows, CPU)

**Chat:** all phone shares and requests alerted correctly. Two misses found ("kya mujy ap apna number dy sakty ha", a bare mistyped number "023456789347"); both fixed in v2.

**Voice with `large-v3-turbo` on CPU:** about 32–37 s per sentence, far slower than real time. A backlog built up (43 sentences waiting, 120–133 s queue wait). **Not usable on this laptop. Urdu testing needs the GPU server.**

**Voice with `small.en`, English, v4:**
* Speed: about 3–4 s per sentence, no backlog (speed factor 0.4–0.7, i.e. faster than real time).
* Detection on the guided English lines spoken by one tester: 8 of 9 "should alert" lines detected. The miss was an email, where the model wrote "the rate gmail" as one word, "therategmail".
* 4 of 4 "should not alert" lines tested stayed quiet: "page number 25", "roll number" (heard as "road number"), "ayah 255" (heard as "la number 255"), "homework on WhatsApp".
* Phone number heard with one digit missing ("0 3 0 0 1 2 3 4 5 6") was still caught (0.80, phone word nearby).
* Alerts reached the admin page with a playable 15 s clip and transcript. Detection about 4.3–4.5 s after the words; clip ready about 6–7.5 s after.
* Only 4 alerts appeared for 8 detections because of the 30 s cooldown (by design). For testing, set `COOLDOWN_S=0`.
* These lines were spoken without Start / Done, so they are not in the Test results tab yet.

**Overall:** one voice, one language, few lines. **Accuracy is not measured yet.** No accuracy claim can be made to the client from these results.

---

## 11. Version history and bugs fixed

| Version | Change |
|---|---|
| v1 | First test app: room, chat, voice pipeline, 15 s clip, admin review, guided test |
| v2 | **Bug:** on a computer slower than real time, sentences reached the model after their audio had been overwritten, so the model heard silence and invented text ("Thank you"). Fix: audio is copied when the sentence is cut; ring buffer raised to 300 s. Near-silent sentences skipped. Silero VAD now runs as a true stream (identical to whole-file output). Start-up prints the settings file and model. Admin warns when the computer is slower than real time. Chat rules: more Roman Urdu spellings ("dy sakty", "bhaij do", "bta do"); bare 10–13 digit numbers alert. |
| v3 | Misheard digits ("to", "for", "tree") count inside a number. Sentence ends after 0.9 s silence instead of 0.5 s, so numbers spoken in groups stay together. 0.5 s kept before speech, so first words are not clipped ("My" was heard as "Y"). Low-confidence speech shown as "not used: ..." instead of disappearing silently. |
| v4 | **Bug:** voice alerts were detected but never saved, because faster-whisper returns numpy numbers that could not be written as JSON. Fix: values converted to plain Python types; JSON writer accepts numpy values. Server errors now print in full in the terminal and show in red on the admin page. Regression test added. |

**Lesson for whoever continues:** the automated tests use a scripted transcriber, so bugs that depend on the real speech model's output (types, timings, invented text) only show on a machine where the model runs. Always test changes with the real model before shipping.

---

## 12. Known limits

* Rule-based detection: indirect or disguised requests ("do you have what I asked for?") are missed.
* Rare words and names are recognised poorly by Whisper; Urdu accuracy is expected to be clearly lower than English.
* Child voices, noisy homes and Urdu–English mixing are expected to reduce accuracy. Not measured yet.
* Echo or a second person in the same room can be attributed to the wrong speaker.
* `small.en` cannot do Urdu. `large-v3-turbo` is too slow on a laptop CPU.
* The test app sends audio browser to server over a WebSocket, not WebRTC/Opus, so its audio quality is slightly better than on the real platform.
* Test app security: no login except the optional admin token; alerts store matched details in plain text; clips are not encrypted. Do not use real data.
* "Tell me your number" and similar are deliberately not alerted (roll-number ambiguity).
* 100 concurrent classes (about 200 audio streams) has **not** been tested. It depends on the client's GPU and needs a benchmark.

---

## 13. Next steps (in order)

1. **English guided test, laptop, `small.en`:** set `COOLDOWN_S=0`, delete test data, run all English lines with Start / Done, with 2–3 different voices. Send the Test results tab.
2. **Fix the rules** from the misses and false alerts (for example "therategmail"). Add each real miss to `eval/text_cases.jsonl` as a regression case.
3. **Get the client's GPU server specification:** GPU model and VRAM, CPU cores, RAM, OS, and whether the video-call server runs on the same machine.
4. **Urdu test on the GPU server** with `large-v3-turbo` (and compare `large-v3`): all Urdu lines, several voices, Quran recitation (case M8), mixed language (M9).
5. **Benchmark concurrency** on the GPU: simulate 25 / 50 / 100 classes with `tools/sim_client.py` and recorded audio; measure queue wait and alert delay. Switch to faster-whisper's batched pipeline if needed.
6. **Measure the false-alarm rate** on long normal class audio (M12), reported as false alerts per class-hour.
7. **Decide with the client** whether the measured accuracy is good enough. Only then:
8. **Integration design:** tap per-participant audio from MiroTalk's mediasoup (PlainTransport to the Python service), identify speakers via the join-URL parameters (`lmsSessionId`, `lmsUserRole`) and `CALLING_APP_API_SECRET`, send alerts to the LMS admin (`notifyAdmins`), store clips encrypted outside `backend/resources/` (that folder is served publicly), with authenticated short-lived links, retention period and access logging.
9. **Later phases:** abusive language (Detoxify for English, a fine-tuned MuRIL for Urdu), then the other monitoring modules.

---

## 14. Open questions for the client

1. Which chat do teachers and students use during live classes: the chat inside the video room, or the LMS chat page?
2. GPU server specification (see step 3).
3. Peak number of simultaneous classes, participants per class, class length.
4. Exactly what counts as personal information and as a violation (for example: is a teacher asking a parent's number allowed?).
5. Evidence retention period for clips and transcripts.
6. Consent wording for recording and analysing class audio (children are involved).
7. Is teacher speech monitored in the same way as student speech?
8. Consent to record 10–20 hours of real class audio for accuracy testing.

---

## 15. Legal and safety notes

* Pakistan has no general data-protection law in force yet (the PDP Bill 2023 is a draft). PECA 2016 and Article 14 of the Constitution (privacy) apply.
* Audio of children is processed, so consent, minimal retention, access control and safeguarding policy are essential before production.
* Store only what is needed: in production, keep only flagged clips and their transcripts, and discard everything else in memory.
