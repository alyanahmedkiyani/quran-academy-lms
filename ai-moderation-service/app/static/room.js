const $ = (id) => document.getElementById(id);
let ws, ctx, node, stream, muted = false, joined = false, activeCase = null, CASES = [];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function join(withMic) {
  $("joinErr").textContent = "";
  if (withMic) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) { $("joinErr").textContent = "Microphone blocked or unavailable: " + e.message; return; }
  }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/room`);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => ws.send(JSON.stringify({ type: "join", name: $("name").value, role: $("role").value, room: $("room").value }));
  ws.onmessage = (e) => onMsg(JSON.parse(e.data), withMic);
  ws.onclose = () => { if (joined) addChat("system", "Disconnected from server."); joined = false; };
}

async function startMic() {
  ctx = new AudioContext();
  await ctx.audioWorklet.addModule("/static/worklet.js");
  const src = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, "down");
  node.port.onmessage = (e) => {
    if (ws && ws.readyState === 1) ws.send(e.data.pcm);
    $("lvl").style.width = Math.min(100, e.data.peak * 140) + "%";
  };
  src.connect(node);
}

function onMsg(m, withMic) {
  if (m.type === "joined") {
    joined = true; $("joinCard").hidden = true; $("roomUI").hidden = false;
    addChat("system", `You joined ${m.room} as ${m.name} (${m.role}).`);
    if (withMic) startMic(); else $("modelState").textContent = "Chat only: no microphone.";
    loadCases();
  } else if (m.type === "chat") addChat(m.from + (m.role ? ` (${m.role})` : ""), m.text);
  else if (m.type === "peers") $("peers").textContent = "In room: " + m.peers.map((p) => p.name).join(", ");
  else if (m.type === "heard") addHeard(m);
}

function addChat(who, text) {
  const d = document.createElement("div"); d.className = "msg";
  d.innerHTML = `<b>${esc(who)}:</b> ${esc(text)}`;
  $("chatlog").appendChild(d); $("chatlog").scrollTop = 1e9;
}
function addHeard(m) {
  const d = document.createElement("div");
  const det = (m.findings || []).map((f) => `<mark>${esc(f.pii)}:${esc(f.kind)} ${f.conf}</mark>`).join(" ");
  const alertTag = m.max_conf >= (m.threshold || .75) ? ' <b style="color:var(--bad)">ALERT</b>' : "";
  d.innerHTML = m.skipped ? `<span class="mute">[not used: ${esc(m.skipped)}]</span>` :
    `${esc(m.text) || '<span class="mute">(nothing recognised)</span>'} <span class="mute">${esc(m.lang || "")} ${m.asr_ms}ms</span> ${det}${alertTag}`;
  $("heard").appendChild(d); $("heard").scrollTop = 1e9;
}

function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

async function loadCases() {
  CASES = await (await fetch("/api/eval/cases")).json();
  const tb = $("cases"); tb.innerHTML = "";
  CASES.forEach((c) => {
    const exp = c.label === "pii" ? `<span class="tp">should alert</span> (${esc(c.pii)})` :
      (c.group === "ambiguous" ? '<span class="mute">should not alert (ambiguous)</span>' : '<span class="tn">should not alert</span>');
    const tr = document.createElement("tr"); tr.className = "case"; tr.id = "case-" + c.id;
    tr.innerHTML = `<td>${c.id}</td><td dir="auto">${esc(c.text)}</td><td>${exp}</td>
      <td><button data-s="${c.id}">Start</button> <button data-c="${c.id}">Send as chat</button></td>`;
    tb.appendChild(tr);
  });
  tb.onclick = (e) => {
    const s = e.target.dataset.s, c = e.target.dataset.c;
    if (s) startCase(s); if (c) chatCase(c);
  };
}
function startCase(id) {
  if (activeCase) doneCase();
  const c = CASES.find((x) => x.id === id); activeCase = c;
  send({ type: "expect", case_id: c.id, label: c.label, pii: c.pii });
  $("speakBox").hidden = false; $("speakText").textContent = c.text; $("speakText").dir = "auto";
  $("speakHint").textContent = `Line ${c.id}. Read it aloud now. ${c.hint || ""}`;
  document.querySelectorAll(".case").forEach((r) => r.classList.toggle("active", r.id === "case-" + id));
}
function doneCase() {
  send({ type: "clear" }); activeCase = null; $("speakBox").hidden = true;
  document.querySelectorAll(".case").forEach((r) => r.classList.remove("active"));
}
function chatCase(id) { const c = CASES.find((x) => x.id === id); send({ type: "chat", text: c.text, case_id: c.id }); }

$("joinBtn").onclick = () => join(true);
$("joinNoMic").onclick = () => join(false);
$("chatSend").onclick = () => { const t = $("chatIn").value.trim(); if (t) { send({ type: "chat", text: t }); $("chatIn").value = ""; } };
$("chatIn").onkeydown = (e) => { if (e.key === "Enter") $("chatSend").click(); };
$("muteBtn").onclick = () => { muted = !muted; if (node) node.port.postMessage({ mute: muted }); $("muteBtn").textContent = muted ? "Unmute" : "Mute"; };
$("doneBtn").onclick = doneCase;
setInterval(async () => {
  if (!joined) return;
  try { const m = await (await fetch("/api/metrics")).json();
    $("modelState").textContent = m.model_error ? "Speech model failed to load: " + m.model_error : m.model_ready ? `Speech model ready (${m.model}).` + (m.queue_len > 0 ? ` Working on ${m.queue_len} sentence(s): please wait before speaking again.` : "") : `Speech model "${m.model}" is loading (first run downloads it). Speak after it is ready.`;
  } catch (e) {}
}, 3000);
