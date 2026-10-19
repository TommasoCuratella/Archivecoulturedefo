/* Send a memory.
   Messages are stored in Firebase Firestore (free plan), the same database as the current site.
   Only memories approved on /memory-admin are shown; a new one waits for approval.
   With the two values empty the page runs as a demo, kept only in this browser. */
(() => {
  const MEMORY_DB = { projectId: "archivecoulture", apiKey: "AIzaSyDCnAWup6HLJilcsHevi7MJpfmQIOaXmCQ" };

  const view = document.querySelector(".mem");
  if (!view) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sound = window.ACSound || { thump() {}, on: false };
  const writeEl = view.querySelector(".mem-write"), wall = view.querySelector(".mem-wall");
  const form = view.querySelector(".mem-form"), ta = view.querySelector("#mem-text"), send = form.querySelector(".mem-send");
  const err = view.querySelector(".mem-err"), skip = view.querySelector(".mem-skip");
  const again = document.querySelector(".mem-again");
  const lang = () => (document.documentElement.getAttribute("data-lang") === "it" ? "it" : "en");
  const MINE = {
    en: "Only you can see it for now. It reaches everyone once it is approved.",
    it: "Per ora lo vedi solo tu. Arriverà a tutti dopo l’approvazione.",
  };

  const LIVE = !!(MEMORY_DB.projectId && MEMORY_DB.apiKey);
  const BASE = LIVE ? `https://firestore.googleapis.com/v1/projects/${MEMORY_DB.projectId}/databases/(default)/documents` : "";
  const clean = (t) => String(t || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // a memory: { id, text }
  let all = [], ids = new Set(), priority = [], bag = [], lastId = "";
  let newest = "", loaded = false;
  let gen = 0, timers = [], pollT = 0, lastBox = null;

  const local = {
    read(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } },
    get() { return local.read("ac-memories").map((m) => (typeof m === "string" ? m : m.text)); },
    add(t) { if (!t) return; try { const a = local.read("ac-memories-pending"); a.push({ id: "p" + Date.now(), text: t, at: new Date().toISOString() }); localStorage.setItem("ac-memories-pending", JSON.stringify(a.slice(-100))); } catch (e) {} },
    sent() { try { return localStorage.getItem("ac-memory-sent") === "1"; } catch (e) { return false; } },
    mark() { try { localStorage.setItem("ac-memory-sent", "1"); } catch (e) {} },
  };

  function addAll(list, toFront) {
    for (const m of list) {
      if (!m.text || ids.has(m.id)) continue;
      ids.add(m.id); all.push(m);
      if (toFront) priority.push(m);
    }
  }
  async function load(fresh) {
    if (!fresh && loaded && newest) return load(true);
    if (!LIVE) { if (!all.length) addAll(local.get().map((t, i) => ({ id: "d" + i + t.length, text: t })), false); return; }
    // only approved memories are shown. First visit: the latest 300; while watching: only the ones approved since
    if (fresh && !newest) fresh = false;
    const approved = { fieldFilter: { field: { fieldPath: "approved" }, op: "EQUAL", value: { booleanValue: true } } };
    const q = { from: [{ collectionId: "memories" }], where: approved, orderBy: [{ field: { fieldPath: "approvedAt" }, direction: "DESCENDING" }], limit: 300 };
    if (fresh) q.where = { compositeFilter: { op: "AND", filters: [approved, { fieldFilter: { field: { fieldPath: "approvedAt" }, op: "GREATER_THAN", value: { timestampValue: newest } } }] } };
    try {
      const res = await fetch(`${BASE}:runQuery?key=${MEMORY_DB.apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery: q }),
      });
      if (!res.ok) return;
      const rows = (await res.json()).filter((r) => r.document);
      for (const r of rows) { const t = r.document.fields && r.document.fields.approvedAt && r.document.fields.approvedAt.timestampValue; if (t && (!newest || t > newest)) newest = t; }
      const got = rows.map((r) => { const f = r.document.fields || {}; return { id: r.document.name, text: clean(f.text && f.text.stringValue) }; });
      addAll(got.reverse(), fresh && all.length > 0);   // memories that arrive while someone is watching come next
      loaded = true;
    } catch (e) {}
  }
  async function save(text) {
    if (!LIVE) { local.add(text); return { id: "mine" + Date.now() }; }
    // it waits for approval before anyone else can see it
    const fields = { text: { stringValue: text }, createdAt: { timestampValue: new Date().toISOString() }, approved: { booleanValue: false } };
    const res = await fetch(`${BASE}/memories?key=${MEMORY_DB.apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error("save failed");
    const doc = await res.json();
    return { id: doc.name };
  }
  function nextMemory() {
    if (priority.length) return priority.shift();
    if (!bag.length) {
      bag = all.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1].id === lastId) bag.unshift(bag.pop());
    }
    return bag.pop() || null;
  }

  /* ---------- the wall: one memory at a time, arriving like a heartbeat ---------- */
  const later = (ms, fn) => { const g = gen; timers.push(setTimeout(() => { if (g === gen) fn(); }, ms)); };
  function stopWall() {
    gen++; timers.forEach(clearTimeout); timers = []; clearInterval(pollT);
    wall.querySelectorAll(".mem-item, .mem-echo").forEach((n) => { n.getAnimations().forEach((a) => a.cancel()); n.remove(); });
  }
  function beat() {
    const a = sound.audio;
    if (!a || !sound.on) return;
    const t = a.ac.currentTime + 0.01;
    sound.thump(t, 70, 40, 1);
    sound.thump(t + 0.27, 82, 46, 0.72);
  }

  // break the memory into lines the same way the page will show it
  const MONO = '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace';
  const mctx = document.createElement("canvas").getContext("2d");
  function layoutText(text, fs, maxW) {
    mctx.font = `400 ${fs}px ${MONO}`;
    const mw = (t) => mctx.measureText(t).width, lines = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (let word of para.split(/ +/)) {
        while (word && mw(word) > maxW) {               // a word longer than the line breaks by letters
          let k = word.length - 1;
          while (k > 1 && mw(word.slice(0, k)) > maxW) k--;
          if (line) { lines.push(line); line = ""; }
          lines.push(word.slice(0, k)); word = word.slice(k);
        }
        if (!word) continue;
        const tryL = line ? line + " " + word : word;
        if (mw(tryL) <= maxW) line = tryL; else { if (line) lines.push(line); line = word; }
      }
      lines.push(line);
    }
    const widths = lines.map(mw);
    return { fs, lines, widths, w: Math.ceil(Math.max(1, ...widths)), lh: fs * 1.6 };
  }

  function next() {
    const m = nextMemory();
    if (!m) { later(2000, next); return; }
    show(m);
  }
  function show(m) {
    lastId = m.id;
    const W = wall.clientWidth, H = wall.clientHeight, small = W < 640;
    const top = small ? 72 : 84, bottom = small ? 110 : 84, side = small ? 18 : 40;
    const text = m.text, len = text.length, room = H - top - bottom;
    let fs = len < 90 ? (small ? 14 : 16) : len < 260 ? (small ? 13 : 14) : len < 700 ? 12 : 11;
    let maxW = len < 260 ? Math.min(440, W * 0.82) : Math.min(680, W * 0.9);
    let L = layoutText(text, fs, maxW), cut = false;
    while (L.lines.length * L.lh > room && fs > 10) { fs--; maxW = Math.min(720, W * 0.9); L = layoutText(text, fs, maxW); }
    const fit = Math.max(1, Math.floor(room / L.lh));
    if (L.lines.length > fit) { L.lines = L.lines.slice(0, fit); L.widths = L.widths.slice(0, fit); cut = true; }
    const w = L.w, h = L.lines.length * L.lh;

    const item = document.createElement("div");
    item.className = "mem-item";
    const p = document.createElement("p");
    p.className = "mem-msg" + (cut ? " cut" : "");
    p.style.fontSize = L.fs + "px"; p.style.width = w + "px";
    for (const line of L.lines) { const sp = document.createElement("span"); sp.textContent = line || " "; p.appendChild(sp); }
    item.appendChild(p);
    if (m.mine) { const n = document.createElement("span"); n.className = "mem-mine"; n.textContent = MINE[lang()]; item.appendChild(n); }

    // somewhere new on the empty screen, away from the last one
    let x = 0, y = 0;
    for (let k = 0; k < 14; k++) {
      x = side + Math.random() * Math.max(0, W - w - side * 2);
      y = top + Math.random() * Math.max(0, H - h - top - bottom);
      if (!lastBox || Math.hypot(x + w / 2 - lastBox[0], y + h / 2 - lastBox[1]) > Math.min(W, H) * 0.3) break;
    }
    lastBox = [x + w / 2, y + h / 2];
    item.style.left = x + "px"; item.style.top = y + "px"; item.style.width = w + "px";
    wall.appendChild(item);

    beat();
    item.animate(reduceMotion
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: "scale(.94)", filter: "blur(8px)" },
          { opacity: 1, transform: "scale(1.025)", filter: "blur(0)", offset: 0.45 },
          { opacity: 1, transform: "scale(1)", filter: "blur(0)" },
        ],
      { duration: reduceMotion ? 900 : 1300, easing: "cubic-bezier(.25,.6,.3,1)", fill: "both" });
    if (!reduceMotion) [[180, 0.32, 1.16], [560, 0.16, 1.3]].forEach(([delay, op, sc]) => {
      const e = item.cloneNode(true);
      e.classList.add("mem-echo");
      wall.appendChild(e);
      e.animate([{ opacity: 0, transform: "scale(1)" }, { opacity: op, transform: "scale(1.025)", offset: 0.12 }, { opacity: 0, transform: `scale(${sc})`, filter: "blur(3px)" }],
        { duration: 1700, delay, easing: "cubic-bezier(.2,.6,.3,1)", fill: "both" }).finished.then(() => e.remove(), () => {});
    });
    // stays 4 seconds (a little longer if the text is long), then fades away and the next one comes
    const hold = 4000 + Math.min(4000, Math.max(0, len - 160) * 10);
    later(hold, () => {
      item.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(5px)" }], { duration: 1200, easing: "ease-out", fill: "forwards" })
        .finished.then(() => item.remove(), () => {});
    });
    later(hold + 1450, next);
  }
  function startWall() {
    stopWall();
    wall.hidden = false;
    again.hidden = false;
    next();
    if (LIVE) pollT = setInterval(() => load(true), 20000);   // new memories from the community join while you watch
  }
  function openWrite() {
    stopWall();
    wall.hidden = true; again.hidden = true;
    writeEl.hidden = false; writeEl.classList.remove("out");
    skip.hidden = !local.sent();
    err.hidden = true;
  }
  function toWall() {
    writeEl.classList.add("out");
    later(reduceMotion ? 200 : 700, () => { writeEl.hidden = true; startWall(); });
  }

  const fit = () => {
    ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px";
    send.disabled = !clean(ta.value);
  };
  ta.addEventListener("input", fit);

  // a light typewriter key under each letter (only when the pulse is on)
  let lastKey = 0, tick = null;
  function typeKey(kind) {
    const a = sound.audio;
    if (!a || !sound.on) return;
    const { ac, master } = a, t = ac.currentTime + 0.005;
    if (t - lastKey < 0.03) return;
    lastKey = t;
    if (!tick) {                                  // a very short, sharp burst: the raw "tac" of metal on paper
      const n = Math.round(ac.sampleRate * 0.04), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.0045));
      tick = buf;
    }
    const burst = (at, type, freq, q, lvl, rate) => {
      const src = ac.createBufferSource(); src.buffer = tick; src.playbackRate.value = rate || 1;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain(); g.gain.value = lvl;
      src.connect(f).connect(g).connect(master); src.start(at);
    };
    const tone = (at, f0, f1, lvl, dur, type) => {
      const o = ac.createOscillator(); o.type = type || "sine";
      o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(lvl, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.02);
    };
    const v = 0.85 + Math.random() * 0.3;
    if (kind === "key" || kind === "back") {
      const soft = kind === "back" ? 0.6 : 1;
      burst(t, "highpass", 5000, 0.7, 0.05 * soft, 1.2);
      const s = t + 0.016 + Math.random() * 0.008;
      burst(s, "bandpass", 2100 + Math.random() * 500, 2.5, 0.3 * v * soft, 0.95 + Math.random() * 0.1);
      burst(s, "bandpass", 4300 + Math.random() * 300, 18, 0.16 * v * soft);
      tone(s, 150, 85, 0.05 * soft, 0.05, "triangle");
    } else if (kind === "space") {
      burst(t, "lowpass", 900, 0.8, 0.28 * v, 0.8);
      tone(t, 110, 70, 0.06, 0.06, "triangle");
    } else if (kind === "line") {
      burst(t, "lowpass", 1200, 0.8, 0.3, 0.8);
      tone(t, 100, 60, 0.07, 0.08, "triangle");
      tone(t + 0.03, 2093, 2088, 0.035, 0.9);
      tone(t + 0.03, 5230, 5220, 0.01, 0.5);
    }
  }
  ta.addEventListener("input", (e) => {
    const k = e.inputType || "";
    if (k === "insertText") typeKey(e.data === " " ? "space" : "key");
    else if (k === "insertLineBreak" || k === "insertParagraph") typeKey("line");
    else if (k.startsWith("delete")) typeKey("back");
    else if (k.startsWith("insert")) typeKey("key");
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = clean(ta.value);
    if (!text || send.disabled) return;
    send.disabled = true; ta.readOnly = true; err.hidden = true;
    try {
      await load(false);
      const saved = await save(text);
      const mine = { id: saved.id, text, mine: true };
      addAll([mine], false);
      priority = [mine].concat(priority.filter((t) => t.id !== mine.id)); // your memory comes first
      local.mark();
      ta.value = ""; fit();
      toWall();
    } catch (x) {
      err.hidden = false;
      send.disabled = false;
    }
    ta.readOnly = false;
  });
  view.querySelector(".mem-enter").addEventListener("click", async (e) => {
    e.preventDefault();
    await load(false);
    toWall();
  });
  again.addEventListener("click", () => { openWrite(); ta.focus(); });

  openWrite();
  load(false);
  if (!matchMedia("(pointer: coarse)").matches) setTimeout(() => ta.focus({ preventScroll: true }), 60);
  let rz = 0;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { lastBox = null; }, 200); });
})();
