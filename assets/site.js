/* Archive Coulture — shared behaviour for every page. No libraries. */
(() => {
  const doc = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- IT / EN for the whole site (remembered per visitor) ---------- */
  const lang = () => (doc.getAttribute("data-lang") === "it" ? "it" : "en");
  function setLang(l) {
    doc.lang = l;
    if (l === "it") doc.setAttribute("data-lang", "it"); else doc.removeAttribute("data-lang");
    $$("[data-set-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setLang === l)));
    $$("[data-ph-en]").forEach((el) => { el.placeholder = el.dataset["ph" + (l === "it" ? "It" : "En")]; });
    $$("[data-aria-it]").forEach((el) => {
      if (!el.dataset.ariaEn) el.dataset.ariaEn = el.getAttribute("aria-label") || "";
      el.setAttribute("aria-label", l === "it" ? el.dataset.ariaIt : el.dataset.ariaEn);
    });
    try { localStorage.setItem("ac-lang", l); } catch (e) {}
    document.dispatchEvent(new CustomEvent("ac:lang", { detail: l }));
  }
  $$("[data-set-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.setLang)));
  setLang(lang());
  window.AC = { lang, reduceMotion };

  /* ---------- menu (phones) ---------- */
  const menu = $("#menu"), menuBtn = $(".menu-btn");
  if (menu && menuBtn) {
    $$("li", menu).forEach((li, i) => li.style.setProperty("--i", i));
    const setOpen = (open) => {
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
      menuBtn.innerHTML = open ? '<span data-l="en">Close</span><span data-l="it" lang="it">Chiudi</span>' : "Menu";
      if (open) $("a", menu).focus({ preventScroll: true });
    };
    menuBtn.addEventListener("click", () => setOpen(menu.hidden));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setOpen(false); menuBtn.focus(); } });
    matchMedia("(min-width: 760px)").addEventListener("change", (m) => { if (m.matches) setOpen(false); });
  }

  /* ---------- clock ---------- */
  const clocks = $$(".clock");
  if (clocks.length) {
    const p2 = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      const t = `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} — ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
      clocks.forEach((c) => { c.textContent = t; });
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- back: return where you came from inside the site, otherwise to the parent page ---------- */
  $$("[data-back]").forEach((a) => a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    let inside = false;
    try { inside = document.referrer && new URL(document.referrer).origin === location.origin && new URL(document.referrer).pathname !== location.pathname; } catch (err) {}
    if (inside && history.length > 1) { e.preventDefault(); history.back(); }
  }));

  /* ---------- lightbox: a photo opens large; arrows, swipe, Esc ---------- */
  const lb = $(".lightbox");
  let openLightbox = () => {};
  if (lb) {
    const big = $("img", lb), count = $(".lb-count", lb), prev = $(".lb-prev", lb), next = $(".lb-next", lb), close = $(".lb-close", lb);
    let set = [], k = 0, opener = null;
    const show = () => {
      const im = set[k];
      big.src = im.currentSrc || im.src; big.alt = im.alt || "";
      count.textContent = set.length > 1 ? String(k + 1).padStart(2, "0") + " / " + String(set.length).padStart(2, "0") : "";
      prev.hidden = next.hidden = set.length < 2;
    };
    openLightbox = (imgs, n) => {
      set = imgs; k = n; opener = document.activeElement; show();
      const from = set[k].getBoundingClientRect();
      lb.classList.add("fade"); lb.hidden = false;
      document.body.style.overflow = "hidden";
      close.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        lb.classList.remove("fade");
        const to = big.getBoundingClientRect();
        if (reduceMotion || !to.width || !from.width) return;
        // the photo grows from where it sits on the page
        big.animate([
          { transform: `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${from.width / to.width})` },
          { transform: "none" },
        ], { duration: 420, easing: "cubic-bezier(.23, 1, .32, 1)" });
      });
    };
    const shut = () => {
      lb.classList.add("fade");
      setTimeout(() => { lb.hidden = true; lb.classList.remove("fade"); big.removeAttribute("src"); document.body.style.overflow = ""; if (opener && opener.focus) opener.focus({ preventScroll: true }); }, 200);
    };
    const step = (d) => { k = (k + d + set.length) % set.length; show(); };
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target === close) shut(); });
    big.addEventListener("click", () => { if (set.length > 1) step(1); else shut(); });
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    window.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") shut();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Tab") { // keep focus inside
        const f = [close, prev, next].filter((b) => !b.hidden);
        const i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        return;
      } else return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    let sx = null;
    lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40 && set.length > 1) step(dx < 0 ? 1 : -1);
    });
  }

  /* ---------- a film opens large, with its sound; Esc or a click outside closes it ---------- */
  const SOUND = (on) => on ? '<span data-l="en">Sound on</span><span data-l="it" lang="it">Audio acceso</span>' : '<span data-l="en">Sound off</span><span data-l="it" lang="it">Audio spento</span>';
  function openFilm(small) {
    const box = document.createElement("div");
    box.className = "film fade";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", small.getAttribute("aria-label") || "Film");
    box.innerHTML = '<video loop playsinline></video>'
      + '<button type="button" class="film-close"><span data-l="en">Close</span><span data-l="it" lang="it">Chiudi</span></button>'
      + '<button type="button" class="vid-sound film-sound" aria-pressed="true">' + SOUND(true) + '</button>';
    const v = $("video", box), snd = $(".film-sound", box), cls = $(".film-close", box);
    v.src = small.currentSrc || small.src; v.poster = small.poster;
    try { v.currentTime = small.currentTime || 0; } catch (e) {}
    v.muted = false;
    small.muted = true;
    const inlineBtn = small.parentElement.querySelector(".vid-sound");
    if (inlineBtn) { inlineBtn.setAttribute("aria-pressed", "false"); inlineBtn.innerHTML = SOUND(false); }
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    v.play().catch(() => { v.muted = true; snd.setAttribute("aria-pressed", "false"); snd.innerHTML = SOUND(false); v.play().catch(() => {}); });
    requestAnimationFrame(() => box.classList.remove("fade"));
    cls.focus({ preventScroll: true });
    const shut = () => {
      box.classList.add("fade");
      removeEventListener("keydown", key, true);
      setTimeout(() => { v.pause(); box.remove(); document.body.style.overflow = ""; small.focus && small.focus({ preventScroll: true }); }, 220);
    };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); shut(); } };
    addEventListener("keydown", key, true);
    box.addEventListener("click", (e) => { if (e.target === box || e.target === cls || cls.contains(e.target)) shut(); });
    snd.addEventListener("click", () => { v.muted = !v.muted; snd.setAttribute("aria-pressed", String(!v.muted)); snd.innerHTML = SOUND(!v.muted); });
    v.addEventListener("click", () => { v.muted = !v.muted; snd.setAttribute("aria-pressed", String(!v.muted)); snd.innerHTML = SOUND(!v.muted); });
  }

  /* ---------- article photographs: column on desktop, swipe strip on phones ---------- */
  $$("[data-strip]").forEach((strip) => {
    const figs = $$(".ph", strip), imgs = figs.map((f) => $("img", f)).filter(Boolean);   // a film in the strip is not a photo
    imgs.forEach((im, n) => {
      im.addEventListener("click", () => openLightbox(imgs, n));
    });
    // a film plays silently on a loop; clicking it (or its label) turns the sound on and off
    $$(".vid", strip).forEach((fig) => {
      const v = $("video", fig), btn = $(".vid-sound", fig);
      const label = () => {
        btn.setAttribute("aria-pressed", String(!v.muted));
        btn.innerHTML = v.muted ? '<span data-l="en">Sound off</span><span data-l="it" lang="it">Audio spento</span>' : '<span data-l="en">Sound on</span><span data-l="it" lang="it">Audio acceso</span>';
      };
      const toggle = () => { v.muted = !v.muted; if (v.paused) v.play().catch(() => {}); label(); };
      v.addEventListener("click", () => openFilm(v));
      btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
      v.play().catch(() => {});
      label();
    });
    strip.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const n = Math.max(0, Math.round(strip.scrollLeft / (figs[0].offsetWidth + 8))); openLightbox(imgs, Math.min(n, imgs.length - 1)); }
    });
    // arrive as they come into view (already visible ones are left alone)
    if ("IntersectionObserver" in window && !reduceMotion) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.remove("wait"); io.unobserve(en.target); }
      }), { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });
      const vh = innerHeight, vw = innerWidth;
      figs.forEach((f, i) => {
        const r = f.getBoundingClientRect();
        if (i > 0 && (r.top > vh * 0.9 || r.left > vw * 0.9)) { f.classList.add("wait"); io.observe(f); }
      });
    }
    // phones: which photo is in view
    const count = strip.parentElement.querySelector(".strip-count b");
    if (count) {
      let raf = 0;
      strip.addEventListener("scroll", () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const w = figs[0].offsetWidth + 8;
          const n = Math.min(figs.length, Math.round(strip.scrollLeft / w) + 1);
          count.textContent = String(n).padStart(2, "0");
        });
      }, { passive: true });
    }
  });

  /* ---------- the text column stays in view while the photographs scroll ---------- */
  const side = $("[data-side]");
  if (side) {
    const fit = () => { side.style.setProperty("--stick", Math.min(0, innerHeight - side.offsetHeight) + "px"); };
    fit();
    addEventListener("resize", fit);
    document.addEventListener("ac:lang", fit);
    if (document.fonts) document.fonts.ready.then(fit);
  }

  /* ---------- carousel pages (Helmut Lang Ads, designers) ---------- */
  $$("[data-show]").forEach((show) => {
    const track = $(".track", show), slides = $$(".slide", show);
    const imgs = slides.map((s) => $("img", s));
    const single = slides.length < 2;
    const cur = $(".cur", show), playBtn = $(".play", show);
    const SLIDE_MS = 4500;
    let i = 0, last = performance.now(), paused = reduceMotion;
    const place = () => {
      const sl = slides[i];
      track.style.transform = "translateX(" + Math.round(show.clientWidth / 2 - (sl.offsetLeft + sl.offsetWidth / 2)) + "px)";
    };
    const go = (k) => {
      i = (k + slides.length) % slides.length;
      slides.forEach((sl, n) => { sl.classList.toggle("on", n === i); sl.setAttribute("aria-hidden", String(n !== i)); });
      if (cur) cur.textContent = String(i + 1).padStart(2, "0");
      place(); last = performance.now();
    };
    const setPaused = (p) => {
      paused = p; last = performance.now();
      if (!playBtn) return;
      playBtn.setAttribute("aria-pressed", String(p));
      playBtn.innerHTML = p ? '<span data-l="en">Play</span><span data-l="it" lang="it">Avvia</span>' : '<span data-l="en">Pause</span><span data-l="it" lang="it">Pausa</span>';
    };
    if (!single) {
      $(".prev", show).addEventListener("click", () => { go(i - 1); setPaused(true); });
      $(".next", show).addEventListener("click", () => { go(i + 1); setPaused(true); });
      playBtn.addEventListener("click", () => setPaused(!paused));
      setPaused(paused);
    }
    slides.forEach((sl, n) => sl.addEventListener("click", () => { if (n !== i) { go(n); setPaused(true); } else openLightbox(imgs, n); }));
    imgs.forEach((im) => im.addEventListener("load", place));
    addEventListener("resize", place);
    let sx = null;
    show.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    show.addEventListener("touchend", (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); setPaused(true); }
    });
    window.addEventListener("keydown", (e) => {
      if (single || /INPUT|TEXTAREA/.test(e.target.tagName) || (lb && !lb.hidden)) return;
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    });
    // [n] in the text shows that image
    $$(".story .ref").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      go(Number(a.dataset.slide) - 1); setPaused(true);
      scrollTo({ top: Math.max(0, show.getBoundingClientRect().top + scrollY - 20), behavior: reduceMotion ? "auto" : "smooth" });
    }));
    go(0);
    if (!single) setInterval(() => {
      if (paused || document.hidden || (lb && !lb.hidden)) { last = performance.now(); return; }
      const r = show.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { last = performance.now(); return; }
      if (performance.now() - last > SLIDE_MS) go(i + 1);
    }, 250);
  });

  /* ---------- designer timelines: a dot opens its details, one at a time ---------- */
  $$(".htl").forEach((t) => {
    const btns = $$(".htl-line button", t), infos = $$(".htl-info", t), hint = $(".htl-hint", t);
    btns.forEach((b) => b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      btns.forEach((x) => x.setAttribute("aria-expanded", String(open && x === b)));
      infos.forEach((x) => { x.hidden = !(open && x.dataset.i === b.dataset.i); });
      if (hint) hint.hidden = open;
    }));
  });

  /* ---------- archive: search (titles and the full text of every article), sort, category ---------- */
  const rowsEl = $("#rows");
  if (rowsEl) {
    const input = $("#q"), none = $(".none"), countEl = $(".count");
    const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const rows = $$(".row", rowsEl).map((li) => ({ li, text: norm(li.textContent + " " + li.dataset.title) }));
    rows.forEach((r, i) => r.li.style.setProperty("--i", i));
    let cat = "all", full = null;
    const loadFull = () => {
      if (full) return full;
      full = fetch("/assets/archive.json").then((r) => r.json()).then((data) => {
        for (const a of data) {
          const r = rows.find((x) => x.li.dataset.route === a.route);
          if (r) r.text += " " + norm([a.title, a.sub, ...a.paras.en, ...a.paras.it].join(" "));
        }
      }).catch(() => {});
      return full;
    };
    function filter() {
      const words = norm(input.value).split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const r of rows) {
        const ok = (cat === "all" || r.li.dataset.cat === cat) && words.every((w) => r.text.includes(w));
        r.li.hidden = !ok; if (ok) shown++;
      }
      none.hidden = shown > 0;
      countEl.textContent = words.length || cat !== "all"
        ? (lang() === "it" ? `${shown} di ${rows.length}` : `${shown} of ${rows.length}`) : "";
      document.dispatchEvent(new Event("ac:rows"));
    }
    function sort(mode) {
      const lis = $$(".row", rowsEl);
      lis.sort((a, b) => mode === "az"
        ? a.dataset.title.localeCompare(b.dataset.title, "en", { sensitivity: "base" })
        : b.dataset.date.localeCompare(a.dataset.date));
      lis.forEach((li) => rowsEl.appendChild(li));
      $$("[data-sort]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === mode)));
      document.dispatchEvent(new Event("ac:rows"));
    }
    input.addEventListener("focus", loadFull, { once: true });
    input.addEventListener("input", () => { filter(); loadFull().then(filter); });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; filter(); } });
    $$("[data-sort]").forEach((b) => b.addEventListener("click", () => sort(b.dataset.sort)));
    // categories stay folded away: they appear only when "Category" is clicked
    const catBtns = $$("button[data-cat]"), catToggle = $(".seg-toggle"), catOpts = $("#cats"), catCur = $(".seg-cur");
    const setCats = (open) => {
      if (!catToggle) return;
      catToggle.setAttribute("aria-expanded", String(open));
      catOpts.hidden = !open;
      const on = catBtns.find((x) => x.getAttribute("aria-pressed") === "true");
      catCur.hidden = open || cat === "all";
      if (on) catCur.innerHTML = on.innerHTML;
    };
    if (catToggle) {
      catToggle.addEventListener("click", () => setCats(catOpts.hidden));
      catOpts.addEventListener("keydown", (e) => { if (e.key === "Escape") { setCats(false); catToggle.focus(); } });
    }
    catBtns.forEach((b) => b.addEventListener("click", () => {
      cat = b.dataset.cat;
      catBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      filter();
      setCats(false);
    }));
    document.addEventListener("ac:lang", filter);
  }

  /* ---------- indexes: the photograph of the entry in focus sits on the right.
     At rest it shows the first entry; on hover it changes and follows the pointer, then settles back ---------- */
  const peek = $(".peek");
  const links = $$("[data-peek]");
  if (peek && links.length && matchMedia("(hover: hover) and (min-width: 960px)").matches) {
    const pic = $("img", peek);
    const list = links[0].closest(".rows, .letters") || links[0].parentElement;
    let y = 0, ty = 0, raf = 0, current = null;
    const loop = () => {
      y += (ty - y) * (reduceMotion ? 1 : 0.14);
      peek.style.setProperty("--y", y.toFixed(1) + "px");
      raf = Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const restY = () => Math.max(70, list.getBoundingClientRect().top + 5);
    const aim = (cy) => {
      const h = peek.offsetHeight || 300;
      ty = cy === null ? restY() : Math.max(70, Math.min(innerHeight - h - 50, cy - h / 2));
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const showOf = (a) => {
      if (current === a) return;
      current = a;
      const w = +a.dataset.peekW || 4, h = +a.dataset.peekH || 5;
      pic.width = 400; pic.height = Math.round(400 * h / w);
      pic.src = a.dataset.peek;
      pic.alt = "";
      if (!reduceMotion) pic.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
    };
    // rest: the first entry, at the height of the list
    showOf(links[0]);
    y = ty = restY(); peek.style.setProperty("--y", y + "px");
    requestAnimationFrame(() => peek.classList.add("on"));
    links.forEach((a) => {
      a.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { showOf(a); aim(e.clientY); } });
      a.addEventListener("pointermove", (e) => { if (current === a) aim(e.clientY); });
      a.addEventListener("focus", () => { showOf(a); aim(a.getBoundingClientRect().top + 8); });
    });
    list.addEventListener("pointerleave", () => aim(null));
    addEventListener("resize", () => aim(null));
    // the first visible entry after a search or a change of order
    document.addEventListener("ac:rows", () => { const f = $$("[data-peek]").find((a) => !a.closest(".row").hidden); if (f) showOf(f); peek.classList.toggle("on", !!f); aim(null); });
  }
})();
