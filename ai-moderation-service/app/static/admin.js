const $ = (id) => document.getElementById(id);
const TOKEN = new URLSearchParams(location.search).get("token") || "";
const q = (u) => u + (u.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(TOKEN);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let alerts = {};

function hl(text, matched) {
  const t = esc(text || ""); const m = esc((matched || "").trim());
  return m && t.toLowerCase().includes(m.toLowerCase()) ? t.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), (x) => `<mark>${x}</mark>`) : t;
}
function card(a) {
  const f = a.clip_flags || {};
  const warn = [];
  if (f.truncated) warn.push("long incident, clip trimmed");
  if (f.missing_before_s) warn.push(`${f.missing_before_s}s before is missing`);
  if (f.missing_after_s) warn.push(`${f.missing_after_s}s after is missing (speaker left early)`);
  const audio = a.source === "voice" ? (a.clip_url
    ? `<audio controls preload="none" src="${q(a.clip_url)}"></audio><div class="mute">15 s clip. Left ear: the flagged speaker. Right ear: everyone else in the class.
       <a href="#" data-mono="${a.id}">Play mixed to both ears</a></div>`
    : `<div class="mute">Clip is being prepared (waiting for the audio after the incident)...</div>`) :
    `<div class="mute">Chat message. Earlier messages: ${esc((a.context || []).map((c) => c.from + ": " + c.text).join(" | ")) || "none"}</div>`;
  const lat = a.source === "voice" ? `detected ${a.detect_latency_s ?? "?"}s after the words, clip ready ${a.ready_latency_s ?? "?"}s after` : "";
  return `<div class="alert ${esc(a.status)}" id="a-${a.id}">
    <div class="row"><span class="tag ${esc(a.source)}">${esc(a.source)}</span><b>${esc(a.pii)} ${esc(a.kind)}</b>
    <span class="mute">confidence ${Number(a.conf).toFixed(2)} (${esc(a.rule)})</span><span class="sp"></span>
    <span class="mute">${new Date(a.created * 1000).toLocaleTimeString()}</span></div>
    <div class="meta">${esc(a.speaker)} (${esc(a.role)}) in ${esc(a.room)}${a.merged_count ? ` , ${a.merged_count} repeat(s) merged` : ""}${a.case_id ? " , test line " + esc(a.case_id) : ""}</div>
    <div class="txt" dir="auto">${hl(a.text, a.matched)}</div>${audio}
    <div class="mute">${lat} ${warn.length ? " , <span style='color:var(--warn)'>" + esc(warn.join("; ")) + "</span>" : ""}</div>
    <div class="row" style="margin-top:8px"><button data-r="true_alarm" data-id="${a.id}">Real violation</button>
    <button data-r="false_alarm" data-id="${a.id}">False alarm</button>
    ${a.source === "voice" ? `<button data-c="1" data-id="${a.id}">Clip is right</button><button data-c="0" data-id="${a.id}">Clip is wrong</button>` : ""}
    <span class="mute">${a.status === "true_alarm" ? "marked real" : a.status === "false_alarm" ? "marked false" : ""}
    ${a.clip_ok === 1 ? " , clip ok" : a.clip_ok === 0 ? " , clip wrong" : ""}</span></div></div>`;
}
function renderAlerts() {
  const list = Object.values(alerts).sort((a, b) => b.created - a.created);
  $("alerts").innerHTML = list.length ? list.map(card).join("") : '<p class="mute">No alerts yet.</p>';
}
async function loadAlerts() {
  const r = await fetch(q("/api/alerts"));
  if (r.status === 401) { $("alerts").textContent = "Admin token needed: add ?token=... to the address."; return; }
  alerts = {}; (await r.json()).forEach((a) => (alerts[a.id] = a)); renderAlerts();
}
function live() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/admin?token=${encodeURIComponent(TOKEN)}`);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "alert" || m.type === "alert_update") {
      const a = m.alert; a.clip_url = a.clip_file ? `/api/clips/${a.id}` : null;
      try { a.clip_flags = JSON.parse(a.clip_flags || "{}"); a.context = JSON.parse(a.context || "[]"); } catch (_) {}
      alerts[a.id] = a; renderAlerts();
      if (m.type === "alert" && "Notification" in window && Notification.permission === "granted") new Notification("Possible personal information", { body: `${a.speaker}: ${a.pii} ${a.kind}` });
    } else if (m.type === "alert_merged") loadAlerts();
    else if (m.type === "utterance") {
      const d = document.createElement("div");
      d.innerHTML = `<span class="mute">${esc(m.room)} / ${esc(m.speaker)} (${esc(m.lang)}, ${m.asr_ms}ms)</span> ` +
        (m.skipped ? `<i class="mute">not used: ${esc(m.skipped)}</i>` : esc(m.text)) +
        (m.max_conf ? ` <mark>${m.max_conf}</mark>` : "");
      $("liveBody").prepend(d);
    }
  };
  ws.onclose = () => setTimeout(live, 2000);
}
document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.t) {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b === t));
    ["alerts", "live", "eval"].forEach((x) => ($(x).hidden = x !== t.dataset.t));
    if (t.dataset.t === "eval") loadEval();
  } else if (t.dataset.r || t.dataset.c !== undefined && t.dataset.id) {
    const body = t.dataset.r ? { status: t.dataset.r } : { clip_ok: Number(t.dataset.c) };
    const r = await fetch(q(`/api/alerts/${t.dataset.id}/review`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const a = await r.json(); alerts[a.id] = a; renderAlerts();
  } else if (t.dataset.mono) {
    e.preventDefault(); const au = t.closest(".alert").querySelector("audio");
    au.src = q(`/api/clips/${t.dataset.mono}?mono=1`); au.play();
  }
});
$("resetBtn").onclick = async () => {
  if (!confirm("Delete all alerts, transcripts, chat logs and clips from this test app?")) return;
  await fetch(q("/api/reset"), { method: "POST" }); alerts = {}; renderAlerts(); $("liveBody").innerHTML = ""; loadEval();
};
async function metrics() {
  try {
    const m = await (await fetch("/api/metrics")).json();
    $("kpi").innerHTML = [["Speech model", m.model_error ? "ERROR: " + m.model_error : (m.model_ready ? m.model + " (ready)" : m.model + " (loading)")], ["Live streams", m.streams],
      ["Waiting to transcribe", m.queue_len], ["Speed (RTF, lower is faster)", m.rtf], ["Transcribe p50 / p95 ms", m.asr_ms_p50 + " / " + m.asr_ms_p95],
      ["Queue wait p95 ms", m.queue_ms_p95], ["Clips preparing", m.pending_clips], ["Alert threshold", m.threshold]]
      .map(([k, v]) => `<div>${k}<b>${esc(v)}</b></div>`).join("") +
      (m.last_error ? `<div style="flex-basis:100%;color:var(--bad);font-size:14px"><b style="color:var(--bad);font-size:14px">Server error:</b> ${esc(m.last_error)} (details in the terminal)</div>` : "") +
      (m.queue_len > 3 || m.queue_ms_last > 15000 ? `<div style="flex-basis:100%;color:var(--bad);font-size:14px"><b style="color:var(--bad);font-size:14px">This computer is slower than real time.</b>
        ${m.queue_len} sentence(s) waiting, last one waited ${Math.round(m.queue_ms_last / 1000)} s. Voice alerts will arrive late. Use one microphone, a smaller model, or a GPU.</div>` : "");
  } catch (e) {}
}
async function loadEval() {
  const d = await (await fetch(q("/api/eval/summary"))).json();
  const s = d.summary, pct = (x) => (x == null ? "n/a" : (x * 100).toFixed(0) + "%");
  const blk = (n, v) => `<div><b>${n}</b>: precision ${pct(v.precision)}, recall ${pct(v.recall)}. Caught ${v.tp}, missed ${v.fn}, false alerts ${v.fp}, correctly quiet ${v.tn}.
    ${v.clip_ready_median_s != null ? `Median time to clip ready ${v.clip_ready_median_s}s.` : ""} ${v.clip_ok + v.clip_bad ? `Clips judged right ${v.clip_ok} of ${v.clip_ok + v.clip_bad}.` : ""}</div>`;
  const cell = (c) => !c ? '<span class="mute">not tested</span>' :
    `<span class="${c.result}">${{ tp: "caught", fn: "MISSED", fp: "FALSE ALERT", tn: "quiet (correct)" }[c.result]}</span><div class="mute" dir="auto">${esc(c.heard.join(" / "))}</div>`;
  $("eval").innerHTML = `<div class="kpi" style="display:grid;gap:6px">${blk("Voice", s.voice)}${blk("Chat", s.chat)}</div>
    <p class="mute">Numbers are only meaningful after you have run many lines, in both languages, with several different voices.</p>
    <table><thead><tr><th>Line</th><th>Expected</th><th>Voice</th><th>Chat</th></tr></thead><tbody>${d.cases.map((r) =>
      `<tr><td>${r.case.id}</td><td dir="auto">${esc(r.case.text)}<div class="mute">${r.case.label === "pii" ? "should alert: " + esc(r.case.pii) : "should not alert"}</div></td><td>${cell(r.voice)}</td><td>${cell(r.chat)}</td></tr>`).join("")}</tbody></table>`;
}
if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
loadAlerts(); live(); metrics(); setInterval(metrics, 2000);
