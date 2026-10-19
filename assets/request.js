/* Request: a small form collected by Netlify Forms.
   while you type a designer or a show, the archive is searched: if it is already on the site,
   the article (or the designer's page) is suggested before you send. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const it = () => document.documentElement.getAttribute("data-lang") === "it";
  const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- character counters ---------- */
  $$("textarea[maxlength]").forEach((ta) => {
    const out = $(`[data-count-for="${ta.id}"]`);
    const upd = () => { if (out) out.textContent = `${ta.value.length} / ${ta.maxLength}`; };
    ta.addEventListener("input", upd); upd();
  });

  /* ---------- sending (Netlify Forms) ---------- */
  const live = /(^|\.)archivecoulture\.com$/.test(location.hostname) || /netlify\.app$/.test(location.hostname);
  $$("form[data-netlify]").forEach((form) => {
    const done = $(`[data-done-for="${form.getAttribute("name")}"]`), err = $(".form-err", form), btn = $("button[type=submit]", form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // at least one choice where a group of boxes is required
      const group = $("[data-required-group]", form);
      if (group && !$$("input:checked", group).length) {
        group.classList.add("need"); $("input", group).focus(); return;
      }
      if (!form.reportValidity()) return;
      btn.disabled = true; err.hidden = true;
      const body = new URLSearchParams(new FormData(form)).toString();
      const finish = () => { form.hidden = true; done.hidden = false; done.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); };
      if (!live) { done.classList.add("demo"); finish(); return; }   // draft preview: nothing is sent
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })
        .then((r) => { if (!r.ok) throw new Error(r.status); finish(); })
        .catch(() => { err.hidden = false; btn.disabled = false; });
    });
    $$("[data-required-group] input", form).forEach((i) => i.addEventListener("change", () => i.closest("[data-required-group]").classList.remove("need")));
  });

  /* ---------- Propose: is it already in the archive? ---------- */
  const box = $("[data-already]");
  if (!box) return;
  const fDesigner = $("#p-designer"), fTopic = $("#p-topic");
  let entries = [], designers = [], loading = null;
  const designersLink = $("[data-designers-src]");
  const load = () => loading || (loading = Promise.all([
    fetch("/assets/archive.json").then((r) => r.json()).catch(() => []),
    designersLink ? fetch(designersLink.getAttribute("href")).then((r) => r.text()).then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      designers = $$(".letters .row a", doc).map((a) => ({ name: $(".t", a).textContent.trim(), href: designersLink.getAttribute("href").replace(/(\.html)?$/, "") + "/" + a.getAttribute("href").split("/").pop() }));
    }).catch(() => {}) : null,
  ]).then(([d]) => { entries = d || []; }));

  // "97" -> "1997", "a/w97" -> "aw 1997": seasons written in any way meet the archive's own spelling
  const years = (t) => (t.match(/\d{2,4}/g) || []).map((y) => (y.length === 2 ? (+y > 40 ? "19" : "20") + y : y));
  const STOP = new Set(["the", "and", "of", "by", "a", "s", "w", "ss", "aw", "fw", "fall", "winter", "spring", "summer", "show", "runway", "collection", "sfilata", "collezione", "di", "il", "la", "le", "e", "del", "della", "from", "to", "in"]);
  const words = (t) => norm(t).split(" ").filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

  function check() {
    const dq = norm(fDesigner.value), tq = fTopic.value;
    if (dq.length < 3 && norm(tq).length < 4) { box.hidden = true; return; }
    load().then(() => {
      const qYears = years(tq + " " + fDesigner.value), qWords = words(tq);
      const hits = [];
      for (const a of entries) {
        const dn = norm(a.designer || "");
        const title = a.title + " " + (a.sub || "");
        const dMatch = !!dn && dq.length >= 3 && (dn.includes(dq) || dq.includes(dn) || dn.split(" ").some((p) => p.length > 3 && dq.split(" ").includes(p)));
        const tWords = words(title).filter((w) => !dn.split(" ").includes(w));
        const wHit = qWords.filter((w) => tWords.some((x) => x.startsWith(w) || w.startsWith(x))).length;
        const yHit = qYears.filter((y) => years(title).includes(y)).length;
        const score = (dMatch ? 3 : 0) + wHit * 2 + yHit * 2;
        const strong = (dMatch && (wHit || yHit)) || wHit >= 2 || (wHit && yHit);
        if (score >= 3) hits.push({ a, score, strong });
      }
      hits.sort((x, y) => y.score - x.score);
      const dPage = designers.find((d) => { const n = norm(d.name); return dq.length >= 3 && (n.includes(dq) || dq.includes(n)); });
      if (!hits.length && !dPage) { box.hidden = true; return; }
      const strong = hits.some((h) => h.strong);
      const head = strong
        ? (it() ? "Ne abbiamo già scritto. Leggilo prima: se pensi che manchi qualcosa, scrivicelo qui sotto." : "We have already written about this. Read it first: if you think something is missing, tell us below.")
        : (it() ? "Nell’archivio c’è già qualcosa su questo designer:" : "The archive already has something on this designer:");
      const list = hits.slice(0, 4).map((h) => `<li><a href="${esc(h.a.route)}">${esc(h.a.title)}${h.a.sub ? " / " + esc(h.a.sub) : ""}</a></li>`).join("")
        + (dPage ? `<li><a href="${esc(dPage.href)}">${esc(dPage.name)} — ${it() ? "biografia" : "biography"}</a></li>` : "");
      box.innerHTML = `<p class="already-head">${head}</p><ul>${list}</ul>`;
      box.hidden = false;
    });
  }
  let t; const later = () => { clearTimeout(t); t = setTimeout(check, 220); };
  fDesigner.addEventListener("input", later); fTopic.addEventListener("input", later);
  fDesigner.addEventListener("focus", load, { once: true });
  document.addEventListener("ac:lang", check);
  // from the archive search with no results: archive → request?q=…
  try { const q = new URLSearchParams(location.search).get("q"); if (q) { fTopic.value = q; check(); } } catch (e) {}
})();
