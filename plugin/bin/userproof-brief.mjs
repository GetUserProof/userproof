#!/usr/bin/env node
// SessionStart hook: in a repo set up with UserProof, tell Claude the site's state in one
// line (always, as context) and show the user that line only when something changed since
// the last time it was shown. Silent and fast everywhere else; never blocks a session.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { keyCandidates, fetchWithKey, rejectedMessage } from "./userproof-keys.mjs";

const API = process.env.USERPROOF_API_URL || "https://api.getuserproof.com";
const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return null; } };

let input = {};
try { input = JSON.parse(read(0) || "{}"); } catch {}
const cwd = input.cwd || process.cwd();
const cfgText = read(join(cwd, ".userproof")) || read(join(cwd, ".whyusersleave"));
if (!cfgText) process.exit(0);
let siteId;
try { siteId = JSON.parse(cfgText).site_id; } catch {}
if (!siteId || !keyCandidates().length) process.exit(0);

let brief, keyNote = null;
try {
  const { res, used, rejected } = await fetchWithKey(`${API}/v2/brief?site_id=${encodeURIComponent(siteId)}`, { signal: AbortSignal.timeout(4000) });
  if (rejected.length) keyNote = rejectedMessage(rejected, used);
  if (!used || !res.ok) {
    // every key rejected: say so once instead of leaving a half-working install
    if (keyNote) process.stdout.write(JSON.stringify({ systemMessage: `UserProof: ${keyNote}` }));
    process.exit(0);
  }
  brief = await res.json();
} catch { process.exit(0); }

const dir = join(homedir(), ".config/userproof");
const stateFile = join(dir, "brief-state.json");
let state = {};
try { state = JSON.parse(read(stateFile) || "{}"); } catch {}
const show = brief.print && state[siteId]?.fingerprint !== brief.fingerprint;
if (show) {
  state[siteId] = { fingerprint: brief.fingerprint, at: new Date().toISOString() };
  try { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); writeFileSync(stateFile, JSON.stringify(state)); } catch {}
}

const userLine = [brief.line, brief.notice, brief.next].filter(Boolean).join(" ");
process.stdout.write(JSON.stringify({
  ...(show || keyNote ? { systemMessage: [show ? userLine : "", keyNote].filter(Boolean).join("\n") } : {}),
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: `${brief.line}${brief.notice ? ` ${brief.notice}` : ""} The UserProof tools (get_top_fix, set_goal, check_fix) are available when the user asks why visitors leave, what to work on, or whether a change worked. /userproof:go runs the whole check in one go.${keyNote ? ` Tell the user: ${keyNote}` : ""}`,
  },
}));
