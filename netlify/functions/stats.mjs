// Private stats page: archivecoulture.com/stats — password in the Netlify environment variable STATS_PASSWORD.
import { getStore } from "@netlify/blobs";
import { timingSafeEqual, createHash } from "node:crypto";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const same = (a, b) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
const NAMES = { direct: "Direct / link without a source", internal: "Inside the site", google: "Google", "other-search": "Other search engines",
  instagram: "Instagram", tiktok: "TikTok", "ig-bio": "Instagram · link in bio", "ig-story": "Instagram · story",
  "ig-post": "Instagram · post", "tiktok-bio": "TikTok · link in bio", facebook: "Facebook", ai: "AI assistants" };
const name = (s) => NAMES[s] || s;

function askPassword(msg) {
  return new Response(msg || "Password required", { status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Archive Coulture stats", charset="UTF-8"', "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

function rows(map, label, total) {
  const list = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!list.length) return '<p class="muted">Nothing yet.</p>';
  return "<table><tr><th>" + label + '</th><th class="n">Visits</th><th class="n">%</th></tr>' + list.map(([k, v]) =>
    "<tr><td>" + k + '</td><td class="n">' + v + '</td><td class="n">' + (total ? Math.round(v * 100 / total) : 0) + "%</td></tr>").join("") + "</table>";
}

export default async (req) => {
  const pass = process.env.STATS_PASSWORD || "";
  if (!pass) return new Response("Set the STATS_PASSWORD environment variable on Netlify first.", { status: 503, headers: { "X-Robots-Tag": "noindex" } });
  const auth = req.headers.get("authorization") || "";
  let given = "";
  try { given = atob(auth.replace(/^Basic\s+/i, "")).split(":").slice(1).join(":"); } catch (e) {}
  if (!auth || !same(given, pass)) return askPassword();

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
  const store = getStore("visits");
  const perDay = {}, sources = {}, pages = {}, campaigns = {};
  let views = 0, arrivals = 0;
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(today.getTime() - i * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
    const { blobs } = await store.list({ prefix: day + "/" });
    perDay[day] = { views: 0, arrivals: 0 };
    for (const b of blobs) {
      const [, src, camp, page] = b.key.split("/");
      const p = decodeURIComponent(page || "/");
      views++; perDay[day].views++;
      pages[p] = (pages[p] || 0) + 1;
      if (src !== "internal") {
        arrivals++; perDay[day].arrivals++;
        sources[src] = (sources[src] || 0) + 1;
        if (camp && camp !== "-") { const k = camp + " · " + name(src); campaigns[k] = (campaigns[k] || 0) + 1; }
      }
    }
  }
  const srcNamed = Object.fromEntries(Object.entries(sources).map(([k, v]) => [esc(name(k)), v]));
  const pagesEsc = Object.fromEntries(Object.entries(pages).map(([k, v]) => ['<a href="' + esc(k) + '">' + esc(k) + "</a>", v]));
  const campEsc = Object.fromEntries(Object.entries(campaigns).map(([k, v]) => [esc(k), v]));
  const dayRows = Object.entries(perDay).map(([d, v]) => '<tr><td>' + d + '</td><td class="n">' + v.arrivals + '</td><td class="n">' + v.views + "</td></tr>").join("");
  const pick = [7, 30, 90, 365].map((n) => n === days ? "<b>" + n + "</b>" : '<a href="?days=' + n + '">' + n + "</a>").join(" / ");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Stats — Archive Coulture</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#fff;color:#000;font:300 13px/1.6 "JetBrains Mono",monospace;letter-spacing:.02em}
main{max-width:860px;margin:0 auto;padding:40px 20px 80px}
h1,h2{font-weight:400;text-transform:uppercase;letter-spacing:.24em}
h1{font-size:15px;margin:0 0 6px}h2{font-size:12px;margin:46px 0 12px}
.muted,th{color:#8a8a8a}.big{display:flex;gap:48px;margin-top:28px;flex-wrap:wrap}.big b{display:block;font-weight:400;font-size:34px;letter-spacing:.04em}
table{width:100%;border-collapse:collapse}th{font-weight:400;text-transform:uppercase;letter-spacing:.16em;font-size:11px;text-align:left}
td,th{padding:7px 0;border-bottom:1px solid #eee}.n{text-align:right;white-space:nowrap;padding-left:16px}td{word-break:break-all}
a{color:inherit}
</style></head><body><main>
<h1>* Archive Coulture — Stats</h1>
<p class="muted">Last ${days} days: ${pick} · Europe/Rome time · no cookies, no personal data</p>
<div class="big"><div><b>${arrivals}</b><span class="muted">visits from outside</span></div><div><b>${views}</b><span class="muted">pages viewed</span></div></div>
<h2>Where people come from</h2>${rows(srcNamed, "Source", arrivals)}
<h2>Campaigns (stories, posts, bio)</h2>${rows(campEsc, "Campaign · source", arrivals)}
<h2>Most viewed pages</h2>${rows(pagesEsc, "Page", views)}
<h2>Day by day</h2><table><tr><th>Day</th><th class="n">From outside</th><th class="n">Pages</th></tr>${dayRows}</table>
</main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
};

export const config = { path: "/stats" };
