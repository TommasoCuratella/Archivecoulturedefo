/* Home: the logo breaks into asterisks where the cursor passes, and phrases surface along its path. */
(() => {
  const L = window.AC_LOGO;
  const canvas = document.getElementById("stage");
  if (!L || !canvas || !canvas.getContext) return;
  const logoPath = new Path2D(L.d);
  const LOGO_W = L.w, LOGO_H = L.h;

  // Phrases that surface as the cursor moves; edit freely.
  const PHRASES = [
    "thank you to be part of the archive",
    "archive clothes for absorbed people",
  ];

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  const sound = window.ACSound || { burst() {}, drive() {} };
  let W = 0, H = 0, DPR = 1;
  let logo = { x: 0, y: 0, w: 0, h: 0, s: 1 };
  let particles = [];
  const STEP = 2;          // css px between logo samples
  const pointer = { x: -9999, y: -9999, speed: 0, inside: false, t: performance.now() };

  /* ---------- layout ---------- */
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const narrow = W < 640;
    let lw = Math.min(W * (narrow ? 0.44 : 0.2), 300);
    let lh = lw * LOGO_H / LOGO_W;
    if (lh > H * 0.2) { lh = H * 0.2; lw = lh * LOGO_W / LOGO_H; }
    logo = { w: lw, h: lh, x: (W - lw) / 2, y: (H - lh) / 2, s: lw / LOGO_W };
    buildParticles();
    clearPhrases();
    dirty = true;
  }

  /* ---------- logo → particles ---------- */
  function buildParticles() {
    const off = document.createElement("canvas");
    const cw = Math.ceil(logo.w), ch = Math.ceil(logo.h);
    particles = [];
    if (cw < 2 || ch < 2) return;
    off.width = cw; off.height = ch;
    const o = off.getContext("2d");
    o.scale(logo.s, logo.s);
    o.fillStyle = "#000";
    o.fill(logoPath, "evenodd");
    const data = o.getImageData(0, 0, cw, ch).data;
    for (let y = 0; y < ch; y += STEP) {
      for (let x = 0; x < cw; x += STEP) {
        let ink = 0, n = 0;
        for (let yy = y; yy < Math.min(y + STEP, ch); yy++)
          for (let xx = x; xx < Math.min(x + STEP, cw); xx++) { ink += data[(yy * cw + xx) * 4 + 3]; n++; }
        if (ink / n > 70) {
          const hx = logo.x + x, hy = logo.y + y;
          particles.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0, off: false, star: Math.random() < 0.35, size: 3.5 + Math.random() * 3, rot: Math.floor(Math.random() * STAR_ROT) });
        }
      }
    }
  }

  /* ---------- physics + render ---------- */
  let disturbance = 0, dirty = true, anyOff = false;
  let nextGlitch = performance.now() + 3000;
  function glitchBand(now) {
    if (reduceMotion || now < nextGlitch) return;
    nextGlitch = now + 2500 + Math.random() * 5000;
    const bandY = logo.y + Math.random() * logo.h;
    const bandH = 3 + Math.random() * 14;
    const kick = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 18);
    for (const p of particles) if (p.hy >= bandY && p.hy < bandY + bandH) p.vx += kick * (0.6 + Math.random() * 0.8);
    sound.burst(0.35);
    dirty = true;
  }
  function step() {
    const R = Math.max(45, logo.w * 0.2), R2 = R * R;
    const sp = Math.min(pointer.speed, 4), px = pointer.x, py = pointer.y;
    let dist = 0, off = false;
    for (const p of particles) {
      const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
      if (pointer.inside && d2 < R2) {
        const d = Math.sqrt(d2) || 1, f = 1 - d / R, push = f * f * (2.2 + sp * 3.5);
        p.vx += (dx / d) * push + (Math.random() - 0.5) * f * 3;
        p.vy += (dy / d) * push + (Math.random() - 0.5) * f * 3;
      }
      if (!p.off && p.vx === 0 && p.vy === 0) continue;
      p.vx += (p.hx - p.x) * 0.045; p.vy += (p.hy - p.y) * 0.045;   // spring home
      p.vx *= 0.84; p.vy *= 0.84;
      p.x += p.vx; p.y += p.vy;
      const m = Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy);
      if (m < 0.35 && Math.abs(p.vx) + Math.abs(p.vy) < 0.1) { p.x = p.hx; p.y = p.hy; p.vx = p.vy = 0; p.off = false; }
      else { p.off = true; off = true; dist += Math.min(m, 40); }
    }
    disturbance = disturbance * 0.85 + (dist / Math.max(particles.length, 1)) * 0.15;
    if (off || anyOff) dirty = true;
    anyOff = off;
  }

  const STAR_ROT = 6;
  let stars = null;
  function makeStars() {
    const px = 48, out = [];
    for (let i = 0; i < STAR_ROT; i++) {
      const c = document.createElement("canvas");
      c.width = c.height = px;
      const x = c.getContext("2d");
      x.fillStyle = "#000";
      x.font = `400 ${px * 1.1}px "JetBrains Mono", ui-monospace, monospace`;
      x.textAlign = "center";
      const m = x.measureText("*");
      x.translate(px / 2, px / 2);
      x.rotate((i / STAR_ROT) * (Math.PI / 3));
      x.fillText("*", 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      out.push(c);
    }
    return out;
  }
  function render() {
    if (!dirty) return;
    dirty = false;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(logo.x, logo.y); ctx.scale(logo.s, logo.s);
    ctx.fillStyle = "#000"; ctx.fill(logoPath, "evenodd");
    ctx.restore();
    if (!anyOff) return;
    // punch holes where fragments have left, and draw the fragments as asterisks
    ctx.fillStyle = "#fff"; ctx.beginPath();
    for (const p of particles) if (p.off) ctx.rect(p.hx - 0.5, p.hy - 0.5, STEP + 1, STEP + 1);
    ctx.fill();
    if (!stars) stars = makeStars();
    for (const p of particles) {
      if (!p.off || !p.star) continue;
      const s = p.size;
      ctx.drawImage(stars[p.rot], p.x + STEP / 2 - s / 2, p.y + STEP / 2 - s / 2, s, s);
    }
  }

  /* ---------- text scramble ---------- */
  const GLYPHS = "†‡⸸✝ᛉᛟᚱᛞ⟊⟟⧖⨳▚▞░▒╳※⌖⌁⏃⏚⋔⟡";
  const g = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  function scramble(el, text, dirIn, done) {
    cancelAnimationFrame(el._raf);
    if (reduceMotion) {
      el.textContent = text;
      el.animate([{ opacity: dirIn ? 0 : 1 }, { opacity: dirIn ? 1 : 0 }], { duration: 400, fill: "forwards" }).finished.then(() => done && done(), () => {});
      return;
    }
    const start = performance.now(), dur = dirIn ? 900 : 450;
    const marks = [...text].map(() => Math.random());
    const tick = (now) => {
      const k = Math.min((now - start) / dur, 1);
      let html = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " ") { html += " "; continue; }
        const resolved = dirIn ? marks[i] < k : marks[i] >= k;
        html += resolved ? ch : (Math.random() < (dirIn ? k : 1 - k) * 1.2 ? `<span class="g">${g()}</span>` : "");
      }
      el.innerHTML = html;
      if (k < 1) el._raf = requestAnimationFrame(tick);
      else { el.innerHTML = dirIn ? text : ""; done && done(); }
    };
    el._raf = requestAnimationFrame(tick);
  }

  /* ---------- phrases along the cursor's path ---------- */
  const layer = document.getElementById("sigils");
  let travelled = 0, lastX = null, lastY = null, phraseIdx = 0;
  const live = new Set();
  function clearPhrases() { for (const ph of live) ph.remove(); live.clear(); }
  function spawnPhrase(x, y) {
    const narrow = W < 640, maxW = narrow ? 170 : 240, pad = 30;
    if (x > logo.x - maxW / 2 - pad && x < logo.x + logo.w + maxW / 2 + pad && y > logo.y - 40 && y < logo.y + logo.h + 40) return; // keep the logo clear
    if (live.size >= 4) return;
    const ph = document.createElement("div");
    ph.className = "phrase";
    const ox = x + (Math.random() - 0.5) * 60, oy = y + (Math.random() < 0.5 ? -1 : 1) * (28 + Math.random() * 30);
    ph.style.left = Math.min(Math.max(ox, maxW / 2 + 16), W - maxW / 2 - 16) + "px";
    ph.style.top = Math.min(Math.max(oy, 80), H - 90) + "px";
    layer.appendChild(ph); live.add(ph);
    const text = PHRASES[phraseIdx++ % PHRASES.length];
    scramble(ph, text, true, () => setTimeout(() => scramble(ph, text, false, () => { ph.remove(); live.delete(ph); }), 1600));
    sound.burst(0.5);
  }

  /* ---------- input ---------- */
  addEventListener("pointermove", (e) => {
    const now = performance.now(), dt = Math.max(now - pointer.t, 1);
    const sp = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) / dt;
    pointer.speed = pointer.inside ? pointer.speed * 0.6 + Math.min(sp, 6) * 0.4 : 0;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = now; pointer.inside = true;
    if (lastX !== null) travelled += Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    if (travelled > (W < 640 ? 160 : 260)) { travelled = 0; spawnPhrase(e.clientX, e.clientY); }
  }, { passive: true });
  addEventListener("pointerdown", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; pointer.speed = 2.5; }, { passive: true });
  const out = () => { pointer.inside = false; pointer.x = pointer.y = -9999; };
  document.addEventListener("pointerleave", out);
  addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") out(); });
  addEventListener("blur", out);
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });

  /* ---------- loop ---------- */
  function frame(now) {
    pointer.speed *= 0.92;
    glitchBand(now);
    step();
    render();
    sound.drive(Math.min(pointer.speed / 3, 1), Math.min(disturbance / 6, 1));
    requestAnimationFrame(frame);
  }
  const start = () => { layout(); requestAnimationFrame(frame); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
})();
