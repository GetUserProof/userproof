// The one API-key resolver, used by the MCP server and the SessionStart brief hook.
// Source of truth: mcp-server/keys.mjs. build.sh copies it next to the hook
// (claude-plugin/bin and plugin-dist/plugin/bin as userproof-keys.mjs). No dependencies.
//
// Order: explicit USERPROOF_* env, the key file setup wrote, the legacy WhyUsersLeave
// file, then legacy WUL_* env vars last (an old shell export must never shadow the key
// setup just wrote). A 401 moves on to the next candidate instead of failing.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const readFile = (p) => { try { return readFileSync(p, "utf8").trim(); } catch { return ""; } };
const KEY_FILE = join(homedir(), ".config", "userproof", "key");
const LEGACY_FILE = join(homedir(), ".config", "whyusersleave", "key");

export const maskKey = (k) => `${k.slice(0, 10)}…`;
export const describeKey = (c) => `${c.source} (${maskKey(c.key)})`;

export function keyCandidates(env = process.env) {
  const raw = [
    ["$USERPROOF_API_KEY", env.USERPROOF_API_KEY],
    ["$USERPROOF_PLUGIN_KEY", env.USERPROOF_PLUGIN_KEY],
    ["$CLAUDE_PLUGIN_OPTION_API_KEY", env.CLAUDE_PLUGIN_OPTION_API_KEY],
    ["~/.config/userproof/key", readFile(KEY_FILE)],
    ["~/.config/whyusersleave/key", readFile(LEGACY_FILE)],
    ["$WUL_PLUGIN_KEY", env.WUL_PLUGIN_KEY],
    ["$WUL_API_KEY", env.WUL_API_KEY],
  ];
  const seen = new Set();
  const out = [];
  for (const [source, v] of raw) {
    const key = (v || "").trim();
    if (!key.startsWith("wul_") || seen.has(key)) continue;
    seen.add(key);
    out.push({ source, key });
  }
  return out;
}

// What to tell the user when a key was rejected. `worked` is the candidate that then
// succeeded, or null when none did.
export function rejectedMessage(rejected, worked) {
  const names = rejected.map(describeKey).join(", ");
  if (worked) {
    const stale = rejected.filter((c) => c.source.startsWith("$"));
    return `UserProof rejected the key from ${names}; ${describeKey(worked)} works. ` +
      (stale.length
        ? `Remove the stale export (${stale.map((c) => c.source.slice(1)).join(", ")}) from your shell profile (~/.zshrc, ~/.zprofile or ~/.bashrc) and open a new terminal.`
        : `Delete the stale key at ${rejected.map((c) => c.source).join(", ")}.`);
  }
  return `UserProof rejected every API key it found: ${names}. Run /userproof:setup to create a new one.`;
}

// fetch with the first key that isn't rejected. Returns
//   { res, used, rejected }   res is null when there is no key at all (candidates empty)
// `used` is the candidate whose response is res; a working key is remembered for the process.
let preferred = null;
export async function fetchWithKey(url, init = {}) {
  let cands = keyCandidates();
  if (preferred) cands = [...cands.filter((c) => c.key === preferred), ...cands.filter((c) => c.key !== preferred)];
  const rejected = [];
  let res = null, used = null;
  for (const c of cands) {
    used = c;
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${c.key}` } });
    if (res.status !== 401) { preferred = c.key; return { res, used, rejected }; }
    rejected.push(c);
  }
  return { res, used: null, rejected };
}
