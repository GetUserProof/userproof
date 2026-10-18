#!/usr/bin/env node
// Find the file and line in this repo that renders a WUL scan defect.
//
//   node wul-locate.mjs --repo . --page /pricing --text "Book a demo" [--href /x] [--tag div] [--html '<div ...>']
//   node wul-locate.mjs --repo . --defect defect.json
//
// Prints JSON: { best: {file, line, snippet, score, why} | null, candidates: [...] }.
// No dependencies, so it runs anywhere the plugin is installed. The agent still opens
// the file to confirm; this only makes the search fast and repeatable.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? null : args[i + 1]; };
let q = { page: opt("page") || "/", text: opt("text") || "", href: opt("href"), tag: opt("tag"), html: opt("html") || "", textSource: opt("text-source") || "inner" };
let sourceLine = opt("source-line");
if (opt("defect")) {
  const d = JSON.parse(readFileSync(opt("defect"), "utf8"));
  sourceLine = d.evidence?.source_line || null;
  q = { page: d.page || "/", text: d.element?.text || "", href: d.element?.href || null, tag: d.element?.tag || null, html: d.element?.html || "", textSource: d.element?.text_source || "inner" };
}
const REPO = opt("repo") || ".";
const EXT = /\.(jsx?|tsx?|mjs|cjs|html?|vue|svelte|astro|mdx|erb|php|hbs|liquid|njk)$/;
const SKIP = /(^|\/)(node_modules|\.next|\.git|dist|build|out|coverage|\.vercel|\.turbo|\.cache|vendor|tmp)(\/|$)|\.min\.js$|\.(test|spec|stories)\.[jt]sx?$/;

function files() {
  try {
    return execFileSync("git", ["-C", REPO, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 64 << 20 })
      .split("\n").filter((f) => EXT.test(f) && !SKIP.test(f));
  } catch {
    const out = [];
    const walk = (d) => {
      for (const n of readdirSync(join(REPO, d))) {
        const rel = d ? `${d}/${n}` : n;
        if (SKIP.test(rel)) continue;
        const st = statSync(join(REPO, rel));
        if (st.isDirectory()) walk(rel);
        else if (EXT.test(n) && st.size < 2_000_000) out.push(rel);
      }
    };
    walk("");
    return out;
  }
}

// how strongly a file path belongs to the page's route (Next app/pages, SvelteKit, Astro, static)
function routeScore(file, page) {
  const segs = page.replace(/\.html?$/, "").split("/").filter(Boolean);
  const f = file.split(sep).join("/").replace(/\([^)]*\)\//g, "");
  if (!segs.length) {
    if (/(^|\/)(app|src\/app)\/page\.[jt]sx?$|(^|\/)pages\/index\.[jt]sx?$|(^|\/)src\/routes\/\+page\.svelte$|(^|\/)src\/pages\/index\.astro$|(^|\/)index\.html?$/.test(f)) return 40;
    return 0;
  }
  const last = segs[segs.length - 1];
  const joined = segs.join("/");
  if (f.includes(`/${joined}/page.`) || f.includes(`pages/${joined}.`) || f.includes(`pages/${joined}/index.`) || f.includes(`routes/${joined}/+page`) || f.endsWith(`${joined}.html`)) return 40;
  if (f.toLowerCase().includes(last.toLowerCase())) return 15;
  return 0;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const terms = [];
// a load error: the line that threw, as served (inline script or unminified file)
if (sourceLine) {
  const core = sourceLine.replace(/\s+/g, " ").trim().slice(0, 80);
  terms.push({ test: (line) => line.replace(/\s+/g, " ").includes(core), w: 90, why: "the line that threw" });
}
const text = norm(q.text || "");
// text from a title or aria-label is often data ({item.label}), so it counts for less
const tw = q.textSource === "inner" || q.textSource === "value" ? 1 : 0.5;
if (text) {
  terms.push({ re: new RegExp(esc(text)), w: 60 * tw, why: "exact text" });
  terms.push({ re: new RegExp(esc(text), "i"), w: 45 * tw, why: "text, any case" });
  // text split across JSX lines or interpolations: match its longest run of words
  const words = text.split(" ");
  if (words.length > 3) terms.push({ re: new RegExp(esc(words.slice(0, 3).join(" ")), "i"), w: 25, why: "first words of text" });
}
const attr = (name) => { const m = q.html.match(new RegExp(`${name}="([^"]+)"`)); return m ? m[1] : null; };
const id = attr("id");
if (id && !/\d{3,}|:r/.test(id)) terms.push({ re: new RegExp(`id=["'{]+${esc(id)}["'}]`), w: 55, why: "element id" });
const aria = attr("aria-label");
if (aria) terms.push({ re: new RegExp(`aria-label=["'{]+${esc(aria)}`), w: 50, why: "aria-label" });
if (q.href) {
  let path = q.href;
  try { path = new URL(q.href).pathname; } catch {}
  terms.push({ re: new RegExp(`href=["'{\`]+${esc(path)}["'}\`]`), w: 55, why: "link href" });
  terms.push({ re: new RegExp(`["'\`]${esc(path)}["'\`]`), w: 35, why: "href string" });
}
const cls = attr("class");
// the element's whole class list, written literally in one place (Tailwind/JSX): strong
const clsTokens = (cls || "").split(/\s+/).filter(Boolean);
if (clsTokens.length >= 4) {
  terms.push({
    test: (line) => {
      const words = new Set(line.split(/[\s"'`{}]+/));
      const hit = clsTokens.filter((c) => words.has(c)).length;
      return hit / clsTokens.length >= 0.8 ? hit / clsTokens.length : 0;
    },
    w: 55, why: "class list",
  });
}
if (cls) {
  // the most specific class names (long, not utility-like) as a weak signal
  const rare = cls.split(/\s+/).filter((c) => c.length > 10 && !/^(hover|focus|md|lg|sm|xl|dark|group|transition|duration|rounded|shadow|text|bg|border|flex|grid|items|justify|px|py|mx|my|mt|mb|ml|mr|pt|pb|w|h|min|max|gap|font|leading|tracking)[-:]/.test(c));
  if (rare.length) terms.push({ re: new RegExp(rare.slice(0, 3).map(esc).join(".*")), w: 20, why: "class names" });
}

const hits = [];
if (terms.length) {
  for (const f of files()) {
    let body;
    try { body = readFileSync(join(REPO, f), "utf8"); } catch { continue; }
    if (body.length > 1_500_000) continue;
    const lines = body.split("\n");
    const rs = routeScore(f, q.page);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 2000) continue;   // minified or data
      let best = null;
      for (const t of terms) if ((t.test ? t.test(line) : t.re.test(line)) && (!best || t.w > best.w)) best = t;
      if (!best) continue;
      let score = best.w + rs;
      if (q.tag && new RegExp(`<${q.tag}[\\s>]`, "i").test(lines.slice(Math.max(0, i - 3), i + 1).join("\n"))) score += 10;
      if (/\.(md|mdx)$/.test(f)) score -= 20;
      if (/(^|\/)(components|app|src|pages|routes|views|layouts)\//.test(f)) score += 5;
      hits.push({ file: f, line: i + 1, score, why: best.why + (rs ? `, route match +${rs}` : ""), snippet: line.trim().slice(0, 200) });
    }
  }
}
hits.sort((a, b) => b.score - a.score);
// one line per file in the alternatives
const seen = new Set();
const candidates = hits.filter((h) => !seen.has(h.file) && seen.add(h.file)).slice(0, 5);
console.log(JSON.stringify({ query: { ...q, html: undefined, repo: relative(process.cwd(), REPO) || "." }, best: candidates[0] || null, candidates }, null, 2));
