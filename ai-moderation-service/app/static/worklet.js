// Captures the microphone, resamples to 16 kHz mono 16-bit and posts 100 ms blocks.
class Down extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; this.pos = 0; this.acc = 0; this.cnt = 0;
    this.buf = new Int16Array(1600); this.n = 0; this.muted = false; this.peak = 0;
    this.port.onmessage = (e) => { if (e.data.mute !== undefined) this.muted = e.data.mute; };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.cnt++; this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const v = this.muted ? 0 : this.acc / this.cnt;   // muted = silence, so the timeline never gaps
        this.acc = 0; this.cnt = 0;
        const s = Math.max(-1, Math.min(1, v));
        this.peak = Math.max(this.peak, Math.abs(s));
        this.buf[this.n++] = s < 0 ? s * 32768 : s * 32767;
        if (this.n === 1600) {
          this.port.postMessage({ pcm: this.buf.slice().buffer, peak: this.peak }, []);
          this.n = 0; this.peak = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("down", Down);
