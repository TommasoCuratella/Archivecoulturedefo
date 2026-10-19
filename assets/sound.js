/* The pulse: a heartbeat on the home page, a dark warm room on Send a memory, a slow chord on Explore.
   Off until the visitor turns it on; the choice is remembered, and it starts again at the first touch or key. */
(() => {
  const body = document.body;
  const page = body.classList.contains("home") ? "home" : body.classList.contains("explore") ? "explore" : "memory";
  const buttons = [...document.querySelectorAll(".pulse")];
  let audio = null, soundOn = false, want = false;
  try { want = localStorage.getItem("ac-pulse") === "1"; } catch (e) {}

  function initAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ac.destination);

    // faint, muffled room tone: the inside of a body
    const len = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const room = ac.createBufferSource(); room.buffer = buf; room.loop = true;
    const roomF = ac.createBiquadFilter(); roomF.type = "lowpass"; roomF.frequency.value = 160;
    const roomG = ac.createGain(); roomG.gain.value = 0;
    room.connect(roomF).connect(roomG).connect(master);
    room.start();

    // short noise burst for the soft "click" of each beat
    const clickBuf = ac.createBuffer(1, Math.round(ac.sampleRate * 0.06), ac.sampleRate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cd.length, 3);

    const beatBus = ac.createGain(); beatBus.connect(master);
    audio = { ac, master, clickBuf, roomG, beatBus, next: 0 };
    return audio;
  }

  // one thump: a sine that drops in pitch, an octave above for small speakers, and a muffled click
  function thump(at, f0, f1, amp) {
    const { ac, clickBuf } = audio, out = audio.beatBus;
    for (const [mult, lvl] of [[1, 1], [2, 0.35]]) {
      const o = ac.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(f0 * mult, at);
      o.frequency.exponentialRampToValueAtTime(f1 * mult, at + 0.14);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(amp * lvl, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      o.connect(g).connect(out);
      o.start(at); o.stop(at + 0.3);
    }
    const c = ac.createBufferSource(); c.buffer = clickBuf;
    const cf = ac.createBiquadFilter(); cf.type = "lowpass"; cf.frequency.value = 260;
    const cg = ac.createGain(); cg.gain.value = amp * 0.9;
    c.connect(cf).connect(cg).connect(out);
    c.start(at);
  }

  function noiseBuf(ac, secs, brown) {
    const len = ac.sampleRate * secs, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { if (brown) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3; } else d[i] = Math.random() * 2 - 1; }
    return buf;
  }
  function reverb(ac, secs) {
    const len = ac.sampleRate * secs, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const cv = ac.createConvolver(); cv.buffer = buf; return cv;
  }
  function breathe(ac, param, rate, depth) {
    const l = ac.createOscillator(); l.frequency.value = rate;
    const g = ac.createGain(); g.gain.value = depth;
    l.connect(g).connect(param); l.start();
  }
  // send a memory: a dark, warm room with a low hum in it
  function memoryTone(a) {
    if (a.memTone) return;
    const ac = a.ac, out = ac.createGain();
    out.gain.value = 0; out.connect(a.master); a.memTone = out;
    const n = ac.createBufferSource(); n.buffer = noiseBuf(ac, 5, true); n.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 650;
    const ng = ac.createGain(); ng.gain.value = 0.16;
    breathe(ac, ng.gain, 0.07, 0.05);
    n.connect(lp).connect(ng).connect(out); n.start();
    const hum = ac.createBiquadFilter(); hum.type = "lowpass"; hum.frequency.value = 520; hum.connect(out);
    [[65.4, 0.07], [130.8, 0.06], [196, 0.035], [261.6, 0.016]].forEach(([f, g], i) => {
      const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = i % 2 ? 4 : -4;
      const og = ac.createGain(); og.gain.value = g;
      breathe(ac, og.gain, 0.045 + i * 0.017, g * 0.45);
      o.connect(og).connect(hum); o.start();
    });
  }
  // explore: a wide, slow chord with a long reverb, and now and then a small high note, like light far away
  function spaceTone(a) {
    if (a.space) return;
    const ac = a.ac, out = ac.createGain();
    out.gain.value = 0; out.connect(a.master); a.space = out;
    const rv = reverb(ac, 4.5), wet = ac.createGain(); wet.gain.value = 0.9;
    rv.connect(wet).connect(out);
    a.spaceIn = ac.createGain(); a.spaceIn.connect(out); a.spaceIn.connect(rv);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 820; lp.Q.value = 0.4;
    breathe(ac, lp.frequency, 0.03, 320);
    lp.connect(a.spaceIn);
    [[110, 0.085], [164.8, 0.065], [196, 0.045], [246.9, 0.032], [261.6, 0.022]].forEach(([f, g], i) => {
      for (const det of [-6, 6]) {
        const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = det + (i % 2 ? 2 : -2);
        const og = ac.createGain(); og.gain.value = g / 2;
        breathe(ac, og.gain, 0.035 + i * 0.013 + (det > 0 ? 0.004 : 0), g * 0.3);
        o.connect(og).connect(lp); o.start();
      }
    });
    const n = ac.createBufferSource(); n.buffer = noiseBuf(ac, 6, false); n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.5;
    breathe(ac, bp.frequency, 0.05, 700);
    const ng = ac.createGain(); ng.gain.value = 0.02;
    n.connect(bp).connect(ng).connect(out); n.start();
  }
  function twinkle(a) {
    if (!soundOn || !a.spaceIn || Math.random() < 0.3) return;
    const ac = a.ac, t = ac.currentTime + 0.02;
    const notes = [659.3, 784, 880, 1046.5, 1174.7];
    const f = notes[Math.floor(Math.random() * notes.length)];
    for (const [mult, lvl] of [[1, 0.06], [2.01, 0.01]]) {
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = f * mult;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(g).connect(a.spaceIn); o.start(t); o.stop(t + 2.7);
    }
  }

  // each page has its own sound, and it fades in slowly
  function apply() {
    if (!audio) return;
    const t = audio.ac.currentTime;
    const fade = (param, to, tau) => { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.setTargetAtTime(to, t, tau); };
    fade(audio.master.gain, soundOn ? 1 : 0, soundOn ? 0.6 : 0.3);
    fade(audio.beatBus.gain, page === "home" || page === "memory" ? 1 : 0, 0.5);
    fade(audio.roomG.gain, page === "home" ? 0.05 : 0, 0.9);
    if (page === "memory") { memoryTone(audio); fade(audio.memTone.gain, 0.78, 1.1); }
    if (page === "explore") {
      spaceTone(audio); fade(audio.space.gain, 1, 1.1);
      clearInterval(audio.twinkleT); audio.twinkleT = setInterval(() => twinkle(audio), 2600);
    }
    if (soundOn) audio.next = Math.max(audio.next, t + 0.2);
  }

  function label() {
    const on = want;
    buttons.forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      const [en, it] = b.querySelectorAll(".pl");
      // the home has a heartbeat; explore and the memories have music, so there it is just "sound"
      if (page === "home") {
        if (en) en.textContent = on ? "Pulse on" : "Pulse off";
        if (it) it.textContent = on ? "Battito acceso" : "Battito spento";
      } else {
        if (en) en.textContent = on ? "Sound on" : "Sound off";
        if (it) it.textContent = on ? "Audio acceso" : "Audio spento";
      }
    });
  }
  function setOn(on) {
    want = on;
    try { localStorage.setItem("ac-pulse", on ? "1" : "0"); } catch (e) {}
    label();
    if (on) {
      const a = initAudio();
      soundOn = !!a;
      if (a && a.ac.state === "suspended") a.ac.resume();
    } else soundOn = false;
    apply();
  }
  buttons.forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); setOn(!want); }));
  label();
  // the visitor asked for the pulse earlier: it comes back with the first touch or key (browsers need one)
  if (want) {
    const wake = (e) => {
      if (e.target && e.target.closest && e.target.closest(".pulse")) return;
      removeEventListener("pointerdown", wake, true); removeEventListener("keydown", wake, true);
      if (want && !soundOn) setOn(true);
    };
    addEventListener("pointerdown", wake, true); addEventListener("keydown", wake, true);
  }
  document.addEventListener("visibilitychange", () => {
    if (!audio) return;
    if (document.hidden) audio.ac.suspend(); else if (soundOn) audio.ac.resume();
  });

  /* ---------- the heartbeat (home): it races while the logo breaks apart, then calms down ---------- */
  let excite = 0, burst = 0;
  function drive(move, corrupt) {
    if (!audio || !soundOn || page !== "home") return;
    const ac = audio.ac, now = ac.currentTime;
    const target = Math.min(1, 0.5 * move + 0.6 * corrupt + 0.4 * burst);
    excite += (target - excite) * (target > excite ? 0.02 : 0.004);
    burst *= 0.985;
    const period = 60 / (54 + 62 * excite);
    if (audio.next < now) audio.next = now + 0.05;
    while (audio.next < now + 0.2) {
      const at = audio.next;
      const amp = 0.55 + 0.25 * excite + (Math.random() - 0.5) * 0.06;
      thump(at, 72, 42, amp);                          // lub
      thump(at + period * 0.3, 84, 48, amp * 0.7);     // dub
      audio.next += period * (1 + (Math.random() - 0.5) * 0.04);
    }
  }

  window.ACSound = {
    get on() { return soundOn; },
    get audio() { return audio; },
    thump: (...a) => { if (audio && soundOn) thump(...a); },
    burst: (v) => { burst = Math.min(1, burst + v * 0.5); },
    drive,
  };
})();
