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
  // a YouTube clip opened on the page, large, from a given second to another (data-yt, data-yt-start, data-yt-end);
  // the link itself still leads to YouTube at the right minute if the player can't open
  function openClip(a) {
    const id = a.dataset.yt, s = parseInt(a.dataset.ytStart || "0", 10), e = parseInt(a.dataset.ytEnd || "0", 10);
    const box = document.createElement("div");
    box.className = "film clip fade";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", a.textContent.trim() || "Video");
    const q = "autoplay=1&rel=0&playsinline=1&modestbranding=1" + (s ? "&start=" + s : "") + (e ? "&end=" + e : "");
    box.innerHTML = '<div class="clip-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + "?" + q + '" title="' + (a.textContent.trim() || "Video").replace(/"/g, "") + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>'
      + '<button type="button" class="film-close"><span data-l="en">Close</span><span data-l="it" lang="it">Chiudi</span></button>'
      + '<a class="clip-out" href="' + a.href + '" target="_blank" rel="noopener">YouTube &nearr;</a>';
    const cls = $(".film-close", box);
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => box.classList.remove("fade"));
    cls.focus({ preventScroll: true });
    const shut = () => {
      box.classList.add("fade");
      removeEventListener("keydown", key, true);
      setTimeout(() => { box.remove(); document.body.style.overflow = ""; a.focus({ preventScroll: true }); }, 220);
    };
    const key = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); shut(); } };
    addEventListener("keydown", key, true);
    box.addEventListener("click", (ev) => { if (ev.target === box || cls.contains(ev.target)) shut(); });
  }
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest("a[data-yt]");
    if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
    ev.preventDefault(); openClip(a);
  });

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
    // on phones only the current photo is shown (see site.css); on larger screens the strip moves with transform
    const phone = matchMedia("(max-width: 759px)");
    const place = () => {
      if (phone.matches) { track.style.transform = ""; return; }
      const sl = slides[i];
      track.style.transform = "translateX(" + Math.round(show.clientWidth / 2 - (sl.offsetLeft + sl.offsetWidth / 2)) + "px)";
    };
    const mark = () => {
      slides.forEach((sl, n) => { sl.classList.toggle("on", n === i); sl.setAttribute("aria-hidden", String(n !== i)); });
      if (cur) cur.textContent = String(i + 1).padStart(2, "0");
    };
    const go = (k) => {
      i = (k + slides.length) % slides.length;
      mark(); retry(imgs[i]); place(); last = performance.now();
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
    // iPhone Safari never loads "lazy" photos that sit off-screen inside the moving track: load them all now,
    // and if one fails, ask for it again when it comes into view
    imgs.forEach((im) => { im.loading = "eager"; im.addEventListener("load", place); });
    const retry = (im) => { if (im && im.complete && !im.naturalWidth && !im.dataset.retried) { im.dataset.retried = "1"; const s = im.src; im.src = ""; im.src = s; } };
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
    let cat = "all", full = null, onlyDesigner = "";
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
        // from a designer's page: only that designer's own articles (by their credits), not every text that names them
        const byDesigner = onlyDesigner && norm(input.value).trim() === onlyDesigner;
        const inCat = cat === "all" || r.li.dataset.cat === cat || (cat === "runway" && r.li.dataset.sub === "runway");
        const ok = inCat && (byDesigner ? norm(r.li.dataset.designer) === onlyDesigner : words.every((w) => r.text.includes(w)));
        r.li.hidden = !ok; if (ok) shown++;
      }
      none.hidden = shown > 0;
      // "no results — propose it": the search goes with you to the Propose page
      const pl = $("a[data-propose]", none);
      if (pl) { pl.dataset.base = pl.dataset.base || pl.getAttribute("href"); const v = input.value.trim(); pl.href = pl.dataset.base + (v ? "?q=" + encodeURIComponent(v) : ""); }
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
    // categories stay folded away: they appear only when "Category" is clicked.
    // First level: All / Fashion / Art / Designers → / Photographers →. Fashion opens its own line (All / Fashion / Runways);
    // All brings the first level back; Runways adds "Filter by brand →" (the brand index)
    const catBtns = $$("button[data-cat]"), catToggle = $(".seg-toggle"), catOpts = $("#cats"), catCur = $(".seg-cur");
    const lvRoot = $('.cat-lv[data-lv="root"]'), lvFashion = $('.cat-lv[data-lv="fashion"]'), catBrand = $(".cat-brand");
    const inFashion = () => cat === "fashion" || cat === "runway";
    const setLevel = () => {
      if (lvRoot && lvFashion) { lvRoot.hidden = inFashion(); lvFashion.hidden = !inFashion(); }
      if (catBrand) catBrand.hidden = cat !== "runway";
      catBtns.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cat === cat)));
    };
    const setCats = (open) => {
      if (!catToggle) return;
      catToggle.setAttribute("aria-expanded", String(open));
      catOpts.hidden = !open;
      catCur.hidden = open || cat === "all";
      const on = catBtns.find((x) => x.dataset.cat === cat);
      if (on) catCur.innerHTML = cat === "runway" ? catBtns.find((x) => x.dataset.cat === "fashion").innerHTML + " / " + on.innerHTML : on.innerHTML;
    };
    if (catToggle) {
      catToggle.addEventListener("click", () => setCats(catOpts.hidden));
      catOpts.addEventListener("keydown", (e) => { if (e.key === "Escape") { setCats(false); catToggle.focus(); } });
    }
    catBtns.forEach((b) => b.addEventListener("click", () => {
      cat = b.dataset.cat;
      setLevel(); filter();
      // Fashion and Runways keep the menu open (their own line, and the brand index link), and so does All on the
      // Fashion line (it brings the first line back); the others close it
      if (!inFashion() && !b.closest('[data-lv="fashion"]')) setCats(false);
    }));
    document.addEventListener("ac:lang", filter);
    // arriving from a designer's page (archive?designer=Hedi+Slimane): the name is in the search bar and the list shows
    // that designer's articles; archive?q=… is a plain search
    let q0 = "", d0 = "";
    try { const sp = new URLSearchParams(location.search); q0 = sp.get("q") || ""; d0 = sp.get("designer") || ""; } catch (e) {}
    if (d0) { input.value = d0; onlyDesigner = norm(d0).trim(); filter(); }
    else if (q0) { input.value = q0; filter(); loadFull().then(filter); }
  }

  /* ---------- runways, one show: a look opens large with its close-ups under it (they open large too);
     "Run the show" plays every photo in order, 1, 1.1, 2, 2.1 … ---------- */
  const looksEl = $("[data-looks]"), lv = $(".look-view");
  if (looksEl && lv) {
    const btns = $$(".look-open", looksEl), big = $(".lv-big", lv), pair = $(".lv-pair", lv);
    const cnt = $(".lv-count", lv), prev = $(".lv-prev", lv), next = $(".lv-next", lv), close = $(".lv-close", lv), play = $(".lv-play", lv);
    const looks = btns.map((b) => [b.dataset.full].concat(b.dataset.details ? b.dataset.details.split("|") : []));
    const seq = []; looks.forEach((l, i) => l.forEach((_, j) => seq.push([i, j])));   // every photo, in order
    const SHOW_MS = 2600;
    let k = 0, part = 0, opener = null, timer = 0;
    const PLAY = '<span data-l="en">Run the show</span><span data-l="it" lang="it">Fai sfilare</span>';
    const PAUSE = '<span data-l="en">Pause</span><span data-l="it" lang="it">Pausa</span>';
    const show = () => {
      const l = looks[k]; part = Math.min(part, l.length - 1);
      big.src = l[part];
      big.alt = $("img", btns[k]).alt + (part ? " — close-up" : "");
      // the photos of this look, under the big one: the full look, then its close-ups
      if (l.length > 1) {
        pair.innerHTML = l.map((src, j) => `<button type="button" class="lv-thumb" data-j="${j}" aria-pressed="${j === part}" aria-label="${j ? "Close-up " + j : "Full look"}"><img src="${src}" alt=""></button>`).join("");
        pair.hidden = false;
      } else { pair.innerHTML = ""; pair.hidden = true; }
      cnt.textContent = String(k + 1).padStart(2, "0") + " / " + String(looks.length).padStart(2, "0");
      prev.hidden = next.hidden = looks.length < 2;
    };
    const stop = () => { clearInterval(timer); timer = 0; play.innerHTML = PLAY; play.setAttribute("aria-pressed", "false"); };
    const advance = () => {
      let at = seq.findIndex(([i, j]) => i === k && j === part);
      if (at >= seq.length - 1) { stop(); return; }   // the show ends on the last photo
      [k, part] = seq[at + 1]; show();
    };
    const start = () => { clearInterval(timer); timer = setInterval(advance, SHOW_MS); play.innerHTML = PAUSE; play.setAttribute("aria-pressed", "true"); };
    const open = (i, run) => {
      k = i; part = 0; opener = document.activeElement; show();
      lv.classList.add("fade"); lv.hidden = false; document.body.style.overflow = "hidden";
      close.focus({ preventScroll: true });
      requestAnimationFrame(() => lv.classList.remove("fade"));
      if (run && !reduceMotion) start(); else stop();
    };
    const shut = () => {
      stop(); lv.classList.add("fade");
      setTimeout(() => { lv.hidden = true; lv.classList.remove("fade"); big.removeAttribute("src"); document.body.style.overflow = ""; if (opener && opener.focus) opener.focus({ preventScroll: true }); }, 200);
    };
    const step = (d) => { stop(); k = (k + d + looks.length) % looks.length; part = 0; show(); };
    btns.forEach((b, i) => b.addEventListener("click", () => open(i, false)));
    $$("[data-run]").forEach((b) => b.addEventListener("click", () => open(0, true)));
    play.addEventListener("click", () => (timer ? stop() : start()));
    pair.addEventListener("click", (e) => { const t = e.target.closest(".lv-thumb"); if (t) { stop(); part = Number(t.dataset.j); show(); } });
    // clicking the big photo goes on to the next one: the close-ups of the look, then the next look
    big.addEventListener("click", () => { stop(); if (part < looks[k].length - 1) { part++; show(); } else step(1); });
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    close.addEventListener("click", shut);
    lv.addEventListener("click", (e) => { if (e.target === lv || e.target.classList.contains("lv-stage")) shut(); });
    window.addEventListener("keydown", (e) => {
      if (lv.hidden) return;
      if (e.key === "Escape") shut();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowDown") { stop(); part = Math.min(part + 1, looks[k].length - 1); show(); }
      else if (e.key === "ArrowUp") { stop(); part = Math.max(part - 1, 0); show(); }
      else if (e.key === " ") { timer ? stop() : start(); }
      else return;
      e.preventDefault();
    });
    let sx = null;
    lv.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lv.addEventListener("touchend", (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40 && looks.length > 1) step(dx < 0 ? 1 : -1);
    });
    // the next photos are fetched ahead while the show runs, so they never arrive late
    const warm = new Set();
    big.addEventListener("load", () => {
      const at = seq.findIndex(([i, j]) => i === k && j === part);
      seq.slice(at + 1, at + 4).forEach(([i, j]) => { const u = looks[i][j]; if (!warm.has(u)) { warm.add(u); const im = new Image(); im.src = u; } });
    });
  }

  /* ---------- runways, one brand: filter the shows by designer, season and year ---------- */
  const rwList = $("[data-runways]");
  if (rwList) {
    const rws = $$(".row", rwList), sel = { designer: "", season: "", year: "" };
    const none = $(".none"), countEl = $(".count");
    const apply = () => {
      let shown = 0;
      for (const li of rws) {
        const ok = (!sel.designer || li.dataset.designer === sel.designer) && (!sel.season || li.dataset.season === sel.season) && (!sel.year || li.dataset.year === sel.year);
        li.hidden = !ok; if (ok) shown++;
      }
      none.hidden = shown > 0;
      const any = sel.designer || sel.season || sel.year;
      countEl.textContent = any ? (lang() === "it" ? `${shown} di ${rws.length}` : `${shown} of ${rws.length}`) : "";
      document.dispatchEvent(new Event("ac:rows"));
    };
    $$("button[data-f]").forEach((b) => b.addEventListener("click", () => {
      sel[b.dataset.f] = b.dataset.v;
      $$(`button[data-f="${b.dataset.f}"]`).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      apply();
    }));
    document.addEventListener("ac:lang", apply);
  }

  /* ---------- indexes: the photograph of the entry in focus sits on the right.
     At rest it shows the first entry; on hover it changes and follows the pointer, then settles back ---------- */
  const peek = $(".peek");
  const links = $$("[data-peek]");
  if (peek && links.length && matchMedia("(hover: hover) and (min-width: 960px)").matches) {
    const pic = $("img", peek);
    const list = links[0].closest(".letters") || links[0].closest(".rows") || links[0].parentElement;   // the whole index (Designers has one list per letter)
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
    // every photograph is fetched and decoded ahead, one after the other, so changing entry is instant
    const ready = new Map();
    const preload = (src) => {
      if (ready.has(src)) return ready.get(src);
      const im = new Image(); im.decoding = "async"; im.src = src;
      const p = (im.decode ? im.decode() : new Promise((ok) => { im.onload = ok; })).catch(() => {});
      ready.set(src, p); return p;
    };
    const queue = links.map((a) => a.dataset.peek);
    const next = () => { const s = queue.shift(); if (s) preload(s).then(() => setTimeout(next, 30)); };
    (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(next);
    let ask = 0;
    const showOf = (a) => {
      if (current === a) return;
      current = a;
      const w = +a.dataset.peekW || 4, h = +a.dataset.peekH || 5, src = a.dataset.peek, n = ++ask;
      const put = () => {
        if (n !== ask) return;                     // the pointer has already moved on: keep only the latest
        pic.width = 400; pic.height = Math.round(400 * h / w);
        pic.src = src; pic.alt = "";
        if (!reduceMotion) pic.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 140, easing: "ease-out" });
      };
      put();                                       // straight away (instant if ready); and again once decoded, if still wanted
      preload(src).then(put);
    };
    // rest: the first entry, at the height of the list
    showOf(links[0]);
    y = ty = restY(); peek.style.setProperty("--y", y + "px");
    requestAnimationFrame(() => peek.classList.add("on"));
    // follow the entry under the pointer on every move (fast moves skip enter events), and while the page scrolls under a still pointer
    let px = -1, py = -1, inside = false, sraf = 0;
    const under = () => { const el = inside && document.elementFromPoint(px, py); const a = el && el.closest && el.closest("[data-peek]"); if (a && list.contains(a)) { showOf(a); aim(py); } };
    list.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX; py = e.clientY; inside = true;
      const a = e.target.closest && e.target.closest("[data-peek]");
      if (a) { showOf(a); aim(e.clientY); }
    });
    addEventListener("scroll", () => { if (inside && !sraf) sraf = requestAnimationFrame(() => { sraf = 0; under(); }); }, { passive: true });
    links.forEach((a) => a.addEventListener("focus", () => { showOf(a); aim(a.getBoundingClientRect().top + 8); }));
    list.addEventListener("pointerleave", () => { inside = false; aim(null); });
    addEventListener("resize", () => aim(null));
    // the first visible entry after a search or a change of order
    document.addEventListener("ac:rows", () => { const f = $$("[data-peek]").find((a) => !a.closest(".row").hidden); if (f) showOf(f); peek.classList.toggle("on", !!f); aim(null); });
  }
})();
