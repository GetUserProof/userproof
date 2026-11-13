#!/usr/bin/env node
// PostToolUse hook (Edit|MultiEdit|Write), 2026-11-12. When a session edits the code that renders the
// site's top UserProof finding (the edit contains the element's text), record the fix once so
// check_fix has a start time, and tell Claude and the user it is now being measured.
// Silent everywhere else; never blocks.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fetchWithKey } from "./userproof-keys.mjs";

const API = process.env.USERPROOF_API_URL || "https://api.getuserproof.com";
const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return null; } };
let input = {};
try { input = JSON.parse(read(0) || "{}"); } catch {}
const pf = join(homedir(), ".config/userproof/pending.json");
let pending = {};
try { pending = JSON.parse(read(pf) || "{}"); } catch {}
const cwd = input.cwd || process.cwd();
const p = pending[cwd];
if (!p || p.recorded || !p.finding_id) process.exit(0);
const text = (p.text || "").trim();
if (text.length < 3) process.exit(0);

const ti = input.tool_input || {};
const file = ti.file_path || "";
if (!/\.(jsx?|tsx?|mjs|cjs|html?|vue|svelte|astro|mdx|erb|php|hbs|liquid|njk)$/.test(file)) process.exit(0);
const touched = [ti.old_string, ti.new_string, ti.content, ...(ti.edits || []).flatMap((e) => [e.old_string, e.new_string])]
  .filter(Boolean).join("\n").toLowerCase();
if (!touched.includes(text.toLowerCase())) process.exit(0);

try {
  const { res } = await fetchWithKey(`${API}/v2/fix-applied`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finding_id: p.finding_id, note: `auto: ${file.split("/").slice(-2).join("/")} edited in Claude Code` }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res?.ok) process.exit(0);
} catch { process.exit(0); }
pending[cwd] = { ...p, recorded: new Date().toISOString() };
try { writeFileSync(pf, JSON.stringify(pending)); } catch {}
const msg = `UserProof recorded this edit as the fix for "${text}" on ${p.page}, so it is now measuring it. Once the change is deployed and about 30 visitors reach the page, check_fix gives the read.`;
process.stdout.write(JSON.stringify({ systemMessage: msg, hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `${msg} Tell the user this in one line when you finish the change. If this edit is not actually the fix, say so; the next mark_fix_applied call replaces the start time.` } }));
