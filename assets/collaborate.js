/* Collaborate: the logo in the middle, arrows out to each topic; a click opens the text beside (or over, on phones). */
(() => {
  const map = document.querySelector("[data-collab]");
  if (!map) return;
  const main = map.closest(".collab");
  const svg = map.querySelector(".cb-lines");
  const core = map.querySelector(".cb-core");
  const nodes = [...map.querySelectorAll(".cb-node")];
  const panel = main.querySelector(".cb-panel");
  const secs = [...panel.querySelectorAll(".cb-sec")];
  const prev = panel.querySelector(".cb-prev"), next = panel.querySelector(".cb-next");
  const NS = "http://www.w3.org/2000/svg";
  let current = -1;

  svg.innerHTML = '<defs><marker id="cb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="context-stroke" stroke-width="1.2"/></marker></defs>';
  const lines = nodes.map((n, i) => {
    const l = document.createElementNS(NS, "line");
    l.setAttribute("marker-end", "url(#cb-arrow)");
    l.style.animationDelay = (120 + i * 70) + "ms";
    svg.appendChild(l);
    n.style.animationDelay = (220 + i * 70) + "ms";
    return l;
  });

  // where a ray from a box centre leaves the box
  const edge = (dx, dy, hw, hh) => { const t = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6)); return [dx * t, dy * t]; };

  function layout() {
    const W = map.clientWidth, H = map.clientHeight;
    if (!W || !H) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const cx = W / 2, cy = H / 2;
    const gut = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gut")) || 16;
    const narrow = W < 620;
    const rx = narrow ? W / 2 - gut - 8 : Math.min(W * 0.36, 430);
    const ry = narrow ? Math.min(H * 0.4, 300) : Math.min(H * 0.38, 290);
    const cw = core.offsetWidth / 2 + 14, ch = core.offsetHeight / 2 + 10;
    nodes.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      const hw = n.offsetWidth / 2, hh = n.offsetHeight / 2;
      let x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      x = Math.max(gut + hw, Math.min(W - gut - hw, x));
      y = Math.max(hh + 4, Math.min(H - hh - 4, y));
      n.style.left = x + "px"; n.style.top = y + "px";
      const dx = x - cx, dy = y - cy;
      const [sx, sy] = edge(dx, dy, cw, ch);
      const [ex, ey] = edge(-dx, -dy, hw + 10, hh + 8);
      const l = lines[i];
      l.setAttribute("x1", cx + sx); l.setAttribute("y1", cy + sy);
      l.setAttribute("x2", x + ex); l.setAttribute("y2", y + ey);
      l.setAttribute("pathLength", "1");
    });
  }

  const label = (i) => { const c = nodes[i].cloneNode(true); c.querySelector(".cb-n").remove(); return c.innerHTML; };
  function open(i, push) {
    if (i < 0 || i >= nodes.length) return;
    current = i;
    nodes.forEach((n, j) => { n.classList.toggle("on", j === i); n.setAttribute("aria-expanded", String(j === i)); });
    lines.forEach((l, j) => l.classList.toggle("on", j === i));
    secs.forEach((s, j) => { s.hidden = j !== i; });
    panel.hidden = false;
    main.classList.add("open");
    document.documentElement.classList.toggle("cb-lock", matchMedia("(max-width: 899px)").matches);
    prev.hidden = i === 0; next.hidden = i === nodes.length - 1;
    if (i > 0) prev.querySelector(".cb-pl").innerHTML = label(i - 1);
    if (i < nodes.length - 1) next.querySelector(".cb-pl").innerHTML = label(i + 1);
    panel.scrollTop = 0;
    try { history.replaceState(null, "", "#" + nodes[i].dataset.k); } catch (e) {}
    requestAnimationFrame(layout);
    if (push !== false) panel.querySelector(".cb-close").focus({ preventScroll: true });
  }
  function close() {
    const was = current;
    current = -1;
    panel.hidden = true;
    main.classList.remove("open");
    document.documentElement.classList.remove("cb-lock");
    nodes.forEach((n) => { n.classList.remove("on"); n.setAttribute("aria-expanded", "false"); });
    lines.forEach((l) => l.classList.remove("on"));
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    requestAnimationFrame(layout);
    if (was >= 0) nodes[was].focus({ preventScroll: true });
  }

  nodes.forEach((n, i) => {
    n.setAttribute("aria-expanded", "false");
    n.addEventListener("click", () => (current === i ? close() : open(i)));
    n.addEventListener("mouseenter", () => lines[i].classList.add("hov"));
    n.addEventListener("mouseleave", () => lines[i].classList.remove("hov"));
  });
  panel.querySelector(".cb-close").addEventListener("click", close);
  prev.addEventListener("click", () => open(current - 1));
  next.addEventListener("click", () => open(current + 1));
  document.addEventListener("keydown", (e) => {
    if (current < 0) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") open(Math.min(current + 1, nodes.length - 1));
    else if (e.key === "ArrowLeft") open(Math.max(current - 1, 0));
  });

  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(map); else addEventListener("resize", layout);
  // the labels change width with the language
  new MutationObserver(() => requestAnimationFrame(layout)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(layout);
  layout();
  const start = nodes.findIndex((n) => "#" + n.dataset.k === location.hash);
  if (start >= 0) open(start, false);
})();
