/* Explore: drift through the archive.
   Photos and phrases come from the articles (assets/archive.json, written by the build), so a new article joins on its own.
   They pass from right to left, each at its own depth: the near ones pass faster. */
(() => {
  const view = document.querySelector(".exp");
  if (!view) return;
  const stage = view.querySelector(".exp-stage"), ov = view.querySelector(".exp-open");
  const body = ov.querySelector(".exp-body"), goLink = ov.querySelector(".exp-go");
  const hint = document.querySelector(".exp-hint");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lang = () => (document.documentElement.getAttribute("data-lang") === "it" ? "it" : "en");
  const HINTS = {
    en: "Drag to move · scroll to go deeper · click to read",
    it: "Trascina per muoverti · scorri per andare più a fondo · clicca per leggere",
  };
  let DATA = [], items = [], built = false, raf = 0, running = false, last = 0, open = false, hovered = null;
  let camZ = 0, panV = 0, driftReady = false;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // split at . ! ? only when a new sentence follows (so "www.helmutlang.com" or "S/S 2004." stay whole)
  const sentences = (t) => (t.match(/.+?[.!?]+["”’)]*(?=\s+[A-Z“"‘(0-9]|\s*$)/g) || [t]).map((x) => x.trim()).filter(Boolean);

  function build() {
    stage.textContent = "";
    built = true; driftReady = false;
    const rnd = mulberry32(1996), l = lang();
    const list = [];
    for (const src of DATA) {
      const a = { route: src.route, title: src.title, sub: src.sub, paras: src.paras[l] || src.paras.en };
      src.imgs.forEach((im) => list.push({ kind: "photo", a, im }));
      // a handful of phrases, spread through the article
      const all = [];
      a.paras.forEach((p, pi) => sentences(p).forEach((s) => all.push({ s, pi })));
      const good = all.filter((x) => x.s.length >= 24 && x.s.length <= 120 && /^[A-Z“"‘0-9]/.test(x.s));
      const n = Math.min(6, good.length);
      for (let k = 0; k < n; k++) { const x = good[Math.floor((k + 0.5) * good.length / n)]; list.push({ kind: "phrase", a, s: x.s, pi: x.pi }); }
    }
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    list.forEach((it) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "exp-item " + it.kind;
      el.dataset.title = it.a.title + (it.a.sub ? " — " + it.a.sub : "");
      if (it.kind === "photo") {
        const im = document.createElement("img");
        const k = 260 / Math.max(it.im.w, it.im.h);
        im.width = Math.round(it.im.w * k); im.height = Math.round(it.im.h * k);
        im.alt = ""; im.decoding = "async"; im.draggable = false;
        im.src = it.im.t;
        el.appendChild(im);
        el.setAttribute("aria-label", it.im.alt);
      } else {
        el.textContent = it.s;
      }
      el.tabIndex = -1;
      stage.appendChild(el);
      it.el = el;
    });
    items = list;
  }
  const place = (it, x, y, sc, op, z, live) => {
    const el = it.el;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
    el.style.opacity = Math.max(0, Math.min(1, op)).toFixed(3);
    el.style.zIndex = String(z);
    el.style.pointerEvents = live ? "auto" : "none";
    el.tabIndex = live && op > 0.6 ? 0 : -1;
  };

  // drift: every photo and phrase sits at its own depth and passes from right to left; the near ones pass faster
  function driftFrame(dt) {
    const W = stage.clientWidth, H = stage.clientHeight, cx = W / 2, cy = H / 2, small = W < 640;
    const photoBase = small ? 0.62 : 0.85, phraseBase = small ? 0.9 : 1.05, margin = small ? 160 : 260;
    if (!driftReady) {
      const rnd = mulberry32(7);
      items.forEach((it) => {
        const Z = it.kind === "phrase" ? 1 + rnd() * 0.9 : 1 + Math.pow(rnd(), 1.3) * 1.8;   // phrases stay near enough to read
        it.g = { Z, X: ((rnd() * (W * 2.4 + 2 * margin)) - margin - cx) * Z, Y: (rnd() * 2 - 1) * H * 0.4 * Z };
      });
      driftReady = true;
    }
    const span = W * 2.4 + 2 * margin;
    if (!open) {
      if (!drag) panV *= Math.pow(0.08, dt);
      const v = (hovered ? 6 : 34) + (drag ? 0 : panV);
      for (const it of items) it.g.X -= v * dt;
    }
    for (const it of items) {
      const g = it.g, d = g.Z - camZ;
      if (d < 0.2) { place(it, -9999, -9999, 0.01, 0, 0, false); continue; }
      const s = 1 / d;
      while (cx + g.X * s < -margin) g.X += span * d;
      while (cx + g.X * s > span - margin) g.X -= span * d;
      const x = cx + g.X * s, y = cy + g.Y * s;
      const near = Math.max(0, Math.min(1, 1 - (d - 1) / 2));
      const op = d < 0.5 ? (d - 0.2) / 0.3 : 0.4 + 0.6 * near;
      place(it, x, y, s * (it.kind === "photo" ? photoBase : phraseBase), op, Math.round(near * 1000), s > 0.45 && x > -50 && x < W + 50);
    }
  }

  function fullOf(it) {
    if (!it.full) it.full = new Promise((ok) => { const im = new Image(); im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok(im)); im.onerror = () => ok(null); im.src = it.im.src; });
    return it.full;
  }
  // hovering slows everything down, so it is easy to catch, and starts loading the sharp photo
  stage.addEventListener("pointerover", (e) => {
    const t = e.target.closest(".exp-item");
    hovered = t && e.pointerType === "mouse" ? t : null;
    if (t && t.classList.contains("photo")) fullOf(items.find((x) => x.el === t));
  });
  stage.addEventListener("pointerout", (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(".exp-item")) hovered = null; });
  stage.addEventListener("focusin", (e) => { hovered = e.target.closest(".exp-item"); });
  stage.addEventListener("focusout", () => { hovered = null; });

  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000) * (reduceMotion ? 0.25 : 1); last = now;
    driftFrame(dt);
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (!built) build(); if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }

  const setHint = () => { if (hint) hint.textContent = HINTS[lang()]; };
  stage.dataset.mode = "drift"; setHint();
  document.addEventListener("ac:lang", () => { setHint(); if (built && !cur) { build(); } });

  /* ---------- moving, flying, clicking ---------- */
  let drag = null, pinch = null, moved = 0;
  const pts = new Map();
  stage.addEventListener("pointerdown", (e) => {
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: camZ }; drag = null; return; }
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), target: e.target.closest(".exp-item") };
    moved = 0;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()], f = Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d;
      camZ = Math.max(-1.5, Math.min(0.85, pinch.c + Math.log(f) * 0.9));
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
    moved += Math.abs(dx) + Math.abs(dy);
    // move the whole field: near things follow your finger, far ones lag behind
    for (const it of items) { it.g.X += dx * (1 - camZ); it.g.Y = Math.max(-stage.clientHeight * 0.7 * it.g.Z, Math.min(stage.clientHeight * 0.7 * it.g.Z, it.g.Y + dy * (1 - camZ) * 0.5)); }
    panV = -(dx * (1 - camZ)) / dt * 0.5;
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!drag) return;
    const target = drag.target;
    drag = null;
    if (moved < 8 && target) openItem(items.find((x) => x.el === target));
  };
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    camZ = Math.max(-1.5, Math.min(0.85, camZ - e.deltaY * 0.0011));     // scroll: go deeper into the field
  }, { passive: false });
  stage.addEventListener("keydown", (e) => {
    const t = e.target.closest(".exp-item");
    if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openItem(items.find((x) => x.el === t)); }
  });

  /* ---------- opening a photo or a phrase: it comes towards you, the archive blurs behind it ---------- */
  const veil = ov.querySelector(".exp-veil"), group = ov.querySelector(".exp-group"), media = ov.querySelector(".exp-media");
  const titleEl = ov.querySelector(".exp-title");
  let cur = null, busy = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (el) => el.getBoundingClientRect();
  const at = (r, bw, bh) => `translate(${r.left}px, ${r.top}px) scale(${r.width / bw}, ${r.height / bh})`;
  const atCenter = (r, bw, bh, s) => `translate(${r.left + r.width / 2 - (bw * s) / 2}px, ${r.top + r.height / 2 - (bh * s) / 2}px) scale(${s})`;
  const EASE = "cubic-bezier(.2,.75,.15,1)";
  const DUR = reduceMotion ? 1 : 1;

  function introOf(a) {
    let t = "";
    for (const s of sentences(a.paras[0] || "")) { if (t && (t + " " + s).length > 320) break; t += (t ? " " : "") + s; }
    return t;
  }
  function fill(it) {
    group.className = "exp-group is-" + it.kind;
    titleEl.textContent = it.a.title;
    if (it.a.sub) { const sm = document.createElement("small"); sm.textContent = it.a.sub; titleEl.appendChild(sm); }
    body.textContent = ""; media.textContent = "";
    media.hidden = it.kind !== "photo";
    const add = (parent, text, cls) => { if (!text) return null; const sp = document.createElement("span"); sp.className = cls; sp.textContent = text; parent.appendChild(sp); return sp; };
    if (it.kind === "photo") {
      const p = document.createElement("p"); p.className = "exp-text"; add(p, introOf(it.a), "soft"); body.appendChild(p);
    } else {
      // the paragraph with the phrase, with a little of what comes before and after: only the phrase is sharp
      const paras = it.a.paras, pi = it.pi;
      const before = pi > 0 ? sentences(paras[pi - 1]).slice(-2).join(" ") : "";
      const after = pi < paras.length - 1 ? sentences(paras[pi + 1]).slice(0, 2).join(" ") : "";
      const own = paras[pi], i = Math.max(0, own.indexOf(it.s));
      if (before) { const p = document.createElement("p"); p.className = "exp-text"; p.setAttribute("aria-hidden", "true"); add(p, "… " + before, "blur"); body.appendChild(p); }
      const p = document.createElement("p"); p.className = "exp-text";
      add(p, own.slice(0, i), "blur"); add(p, it.s, "sharp"); add(p, own.slice(i + it.s.length), "blur");
      body.appendChild(p);
      if (after) { const q = document.createElement("p"); q.className = "exp-text"; q.setAttribute("aria-hidden", "true"); add(q, after + " …", "blur"); body.appendChild(q); }
    }
    goLink.href = it.a.route;
  }

  async function openItem(it) {
    if (!it || busy || cur) return;
    busy = true; open = true; cur = it;
    let sharpSrc = null;
    if (it.kind === "photo") { const im = await Promise.race([fullOf(it), wait(1200)]); if (im) sharpSrc = im.src; }
    fill(it);
    ov.hidden = false; ov.classList.remove("shown"); group.classList.remove("tilted");
    ov.querySelector(".exp-scene").scrollTop = 0;
    const W = innerWidth, H = innerHeight, wide = W >= 760;
    let fly, frames, big = null;
    if (it.kind === "photo") {
      const small = it.el.querySelector("img");
      const k = Math.min((wide ? Math.min(W * 0.5, 720) : W - 32) / it.im.w, (wide ? H * 0.74 : H * 0.46) / it.im.h);
      const tw = Math.round(it.im.w * k), th = Math.round(it.im.h * k);
      big = document.createElement("img");
      big.alt = it.im.alt; big.width = tw; big.height = th; big.src = sharpSrc || small.currentSrc || small.src;
      big.style.opacity = "0";
      media.appendChild(big);
      if (!sharpSrc) fullOf(it).then((im) => { if (im) big.src = im.src; });
      const from = box(small), to = box(big);
      fly = document.createElement("img");
      fly.src = big.src; fly.width = tw; fly.height = th;
      frames = [{ transform: at(from, tw, th) }, { transform: at(to, tw, th) }];
    } else {
      const sharp = body.querySelector(".sharp");
      sharp.style.opacity = "0";
      const from = box(it.el), to = box(sharp);
      const bw = it.el.offsetWidth, bh = it.el.offsetHeight;
      fly = it.el.cloneNode(true);
      const s = parseFloat(getComputedStyle(sharp).fontSize) / parseFloat(getComputedStyle(it.el).fontSize);
      frames = [{ transform: at(from, bw, bh), opacity: 1 }, { opacity: 1, offset: 0.62 }, { transform: atCenter(to, bw, bh, s), opacity: 0 }];
      sharp.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: reduceMotion ? 0 : 520, fill: "forwards" }).finished.then(() => { sharp.style.opacity = ""; }, () => {});
    }
    fly.className = it.kind === "photo" ? "exp-fly" : "exp-fly exp-item phrase";
    fly.removeAttribute("style");
    if (it.kind !== "photo") fly.style.width = it.el.offsetWidth + "px";
    ov.appendChild(fly);
    it.el.style.visibility = "hidden";
    stage.classList.add("dim");
    veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "ease-out", fill: "both" });
    await fly.animate(frames, { duration: reduceMotion ? 1 : 850 * DUR, easing: EASE, fill: "forwards" }).finished.catch(() => {});
    if (big) big.style.opacity = "";
    fly.remove();
    ov.classList.add("shown");
    if (!reduceMotion) group.classList.add("tilted");
    busy = false;
    goLink.focus({ preventScroll: true });
  }

  async function closeItem() {
    if (!cur || busy) return;
    busy = true;
    const it = cur;
    ov.classList.remove("shown");
    group.classList.add("closing"); group.classList.remove("tilted");
    await wait(reduceMotion ? 0 : 380);
    group.classList.remove("closing");
    let fly, frames;
    if (it.kind === "photo") {
      const big = media.querySelector("img"), small = it.el.querySelector("img");
      const from = box(big), to = box(small), tw = big.width, th = big.height;
      fly = document.createElement("img");
      fly.src = big.currentSrc || big.src; fly.width = tw; fly.height = th;
      big.style.opacity = "0";
      frames = [{ transform: at(from, tw, th) }, { transform: at(to, tw, th) }];
    } else {
      const sharp = body.querySelector(".sharp");
      const from = box(sharp), to = box(it.el), bw = it.el.offsetWidth, bh = it.el.offsetHeight;
      const s = parseFloat(getComputedStyle(sharp).fontSize) / parseFloat(getComputedStyle(it.el).fontSize);
      fly = it.el.cloneNode(true);
      sharp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      frames = [{ transform: atCenter(from, bw, bh, s), opacity: 0 }, { opacity: 1, offset: 0.35 }, { transform: at(to, bw, bh), opacity: 1 }];
    }
    fly.className = it.kind === "photo" ? "exp-fly" : "exp-fly exp-item phrase";
    fly.removeAttribute("style");
    fly.style.visibility = "visible";
    if (it.kind !== "photo") fly.style.width = it.el.offsetWidth + "px";
    ov.appendChild(fly);
    stage.classList.remove("dim");
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease-in", fill: "both" });
    await fly.animate(frames, { duration: reduceMotion ? 1 : 750, easing: EASE, fill: "forwards" }).finished.catch(() => {});
    it.el.style.visibility = "";
    fly.remove();
    ov.hidden = true;
    cur = null; open = false; busy = false;
    it.el.focus({ preventScroll: true });
  }

  // the open photo or passage leans a little towards the pointer
  ov.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || reduceMotion) return;
    group.style.setProperty("--mx", ((e.clientX / innerWidth) - 0.5).toFixed(3));
    group.style.setProperty("--my", ((e.clientY / innerHeight) - 0.5).toFixed(3));
  });
  ov.addEventListener("click", (e) => {
    if (e.target.closest(".exp-close") || !e.target.closest(".exp-copy, .exp-media img")) closeItem();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && cur) closeItem(); });

  fetch("/assets/archive.json").then((r) => r.json()).then((d) => { DATA = d; start(); }).catch(() => {
    if (hint) hint.textContent = lang() === "it" ? "Archivio non disponibile." : "The archive could not be loaded.";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (built) start();
  });
})();
