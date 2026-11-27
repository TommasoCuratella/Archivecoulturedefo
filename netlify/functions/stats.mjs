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

function bars(map, total, fmt) {
  const list = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!list.length) return '<p class="muted">Nothing yet.</p>';
  const max = list[0][1];
  return '<ul class="bars">' + list.map(([k, v]) =>
    '<li><span class="lab">' + (fmt ? fmt(k) : esc(k)) + '</span><span class="num">' + v + ' <i>' + (total ? Math.round(v * 100 / total) : 0) + '%</i></span>' +
    '<span class="bar"><b style="width:' + Math.max(2, Math.round(v * 100 / max)) + '%"></b></span></li>').join("") + "</ul>";
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
        if ((camp && camp !== "-") || /^(ig|tiktok)-/.test(src)) { const k = (camp && camp !== "-" ? camp + " · " : "") + name(src); campaigns[k] = (campaigns[k] || 0) + 1; }
      }
    }
  }
  const order = Object.keys(perDay).reverse();                       // oldest → newest, left → right
  const maxDay = Math.max(1, ...order.map((d) => perDay[d].views));
  const fmtDay = (d) => d.slice(8, 10) + "." + d.slice(5, 7);
  const chart = order.map((d) => {
    const v = perDay[d];
    return '<div class="col" title="' + fmtDay(d) + ': ' + v.arrivals + ' from outside, ' + v.views + ' pages">' +
      '<div class="stack"><b class="pv" style="height:' + Math.round(v.views * 100 / maxDay) + '%"></b>' +
      '<b class="ar" style="height:' + Math.round(v.arrivals * 100 / maxDay) + '%"></b></div>' +
      '<span class="cn">' + (v.arrivals || "") + '</span><span class="dl">' + fmtDay(d) + "</span></div>";
  }).join("");
  const todayKey = order[order.length - 1], yKey = order[order.length - 2];
  const topSrc = Object.entries(sources).sort((a, b) => b[1] - a[1])[0];
  const pick = [7, 30, 90, 365].map((n) => n === days ? "<b>" + n + " days</b>" : '<a href="?days=' + n + '">' + n + " days</a>").join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Stats — Archive Coulture</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font:300 13px/1.55 "JetBrains Mono",monospace;letter-spacing:.02em}
main{max-width:1280px;margin:0 auto;padding:32px 28px 64px}
h1,h2{font-weight:400;text-transform:uppercase}
h1{font-size:14px;letter-spacing:.28em;margin:0}
h2{font-size:11px;letter-spacing:.24em;margin:0 0 16px;color:#8a8a8a}
.muted{color:#8a8a8a}a{color:inherit}
header{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;padding-bottom:22px;border-bottom:1px solid #000}
.range{display:flex;gap:6px}.range a,.range b{font-weight:400;padding:4px 10px;border:1px solid #ddd;text-decoration:none;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.range b{background:#000;color:#fff;border-color:#000}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #eee}
.kpi{padding:22px 20px 22px 0}.kpi+.kpi{padding-left:20px;border-left:1px solid #eee}
.kpi b{display:block;font-weight:400;font-size:38px;line-height:1.1;letter-spacing:.02em}.kpi b.s{font-size:20px;line-height:1.9}
.kpi span{color:#8a8a8a;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
section{padding:30px 0;border-bottom:1px solid #eee}
.legend{display:flex;gap:18px;font-size:11px;color:#8a8a8a;margin:-6px 0 14px}.legend i{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px}
.chart{display:flex;align-items:stretch;gap:3px;height:190px}
.col{flex:1;display:flex;flex-direction:column;align-items:center;min-width:0}
.stack{flex:1;width:100%;position:relative;border-bottom:1px solid #000}
.stack b{position:absolute;left:12%;right:12%;bottom:0}.pv{background:#e6e6e6}.ar{background:#000}
.cn{font-size:10px;height:15px;margin-top:4px}.dl{font-size:9px;color:#8a8a8a;white-space:nowrap}
.chart.many .dl{visibility:hidden}.chart.many .col:nth-child(7n+1) .dl{visibility:visible}.chart.many .cn{display:none}
.cols{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:44px}
.bars{list-style:none;margin:0;padding:0}.bars li{display:grid;grid-template-columns:1fr auto;column-gap:12px;padding:7px 0}
.lab{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.num{text-align:right}.num i{font-style:normal;color:#8a8a8a;margin-left:6px}
.bar{grid-column:1/3;height:3px;background:#f2f2f2;margin-top:6px}.bar b{display:block;height:100%;background:#000}
footer{padding-top:18px;font-size:11px}
@media (max-width:900px){.kpis{grid-template-columns:1fr 1fr}.kpi:nth-child(3){padding-left:0;border-left:0}.kpi:nth-child(n+3){border-top:1px solid #eee}.cols{grid-template-columns:1fr;gap:34px}.chart{height:150px}.chart .dl{visibility:hidden}.chart .col:nth-child(7n+1) .dl{visibility:visible}.chart .cn{display:none}}
</style></head><body><main>
<header><h1>* Archive Coulture — Stats</h1><nav class="range">${pick}</nav></header>
<div class="kpis">
<div class="kpi"><b>${arrivals}</b><span>Visits from outside</span></div>
<div class="kpi"><b>${views}</b><span>Pages viewed</span></div>
<div class="kpi"><b>${perDay[todayKey].arrivals}</b><span>Today · yesterday ${yKey ? perDay[yKey].arrivals : 0}</span></div>
<div class="kpi"><b class="s">${topSrc ? esc(name(topSrc[0])) : "—"}</b><span>Top source</span></div>
</div>
<section><h2>Day by day</h2>
<div class="legend"><span><i style="background:#000"></i>Visits from outside</span><span><i style="background:#e6e6e6"></i>Pages viewed</span></div>
<div class="chart${order.length > 31 ? " many" : ""}">${chart}</div></section>
<section class="cols">
<div><h2>Where people come from</h2>${bars(sources, arrivals, (k) => esc(name(k)))}</div>
<div><h2>Stories, posts, bio</h2>${bars(campaigns, arrivals)}</div>
<div><h2>Most viewed pages</h2>${bars(pages, views, (k) => '<a href="' + esc(k) + '">' + esc(k === "/" ? "/ (home)" : k) + "</a>")}</div>
</section>
<footer class="muted">Europe/Rome time · counted only on archivecoulture.com · no cookies, no personal data · “from outside” = arrivals, not clicks inside the site</footer>
</main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
};

export const config = { path: "/stats" };
