// Visit counter, our own: one tiny request per page view, sent by assets/site.js.
// Stores no cookies and nothing personal: only the day, where the visit came from, the campaign and the page.
// Each visit is one empty entry whose name holds that information, so two visits at once never overwrite each other.
import { getStore } from "@netlify/blobs";

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|facebookexternalhit/i;
const slug = (s, n = 40) => String(s || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, n);

function source(d) {
  if (d.s) return slug(d.s);                       // link with ?utm_source=… (stories, posts, bio)
  let host = "";
  try { host = new URL(d.r).hostname.replace(/^www\./, ""); } catch (e) { return "direct"; }
  if (!host) return "direct";
  if (/(^|\.)archivecoulture\.com$/.test(host)) return "internal";
  if (/(^|\.)google\./.test(host)) return "google";
  if (/instagram\.com$/.test(host)) return "instagram";
  if (/tiktok\.com$/.test(host)) return "tiktok";
  if (/(facebook\.com|fb\.me)$/.test(host)) return "facebook";
  if (/(bing\.com|duckduckgo\.com|yahoo\.|ecosia\.org|yandex\.|baidu\.com|qwant\.com)/.test(host)) return "other-search";
  if (/(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/.test(host)) return "ai";
  return slug(host);
}

export default async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (BOTS.test(req.headers.get("user-agent") || "")) return new Response(null, { status: 204 });
  let d;
  try { d = JSON.parse((await req.text()).slice(0, 2000)); } catch (e) { return new Response(null, { status: 400 }); }
  const page = String(d.p || "/").split(/[?#]/)[0].slice(0, 120);
  if (!page.startsWith("/")) return new Response(null, { status: 400 });
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });   // 2026-11-27
  const key = [day, source(d), slug(d.c) || "-", encodeURIComponent(page),
               Date.now().toString(36) + Math.random().toString(36).slice(2, 8)].join("/");
  await getStore("visits").set(key, "");
  return new Response(null, { status: 204 });
};

export const config = { path: "/api/hit" };
