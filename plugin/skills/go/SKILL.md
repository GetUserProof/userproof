---
name: go
description: One word, whole check. Checks the fixes already shipped, gets the top fix from real visitor sessions, and when nothing passes the evidence bar reads the funnel and returns the biggest visible leak as a lead. Use when the user says "userproof go", "go", or wants the quick answer without choosing a step.
---

Run the whole UserProof loop in one pass with the userproof MCP tools. If the tools are unavailable or say no API key is configured, run `/userproof:setup` and stop.

The active site comes from `.userproof` (`site_id`); if the tools say there is no active site, call `select_site`.

1. **Check earlier fixes.** For each fix in `.userproof` `fixes`, call `check_fix` and report the signal and conversion verdicts exactly as returned ("inconclusive" means not enough traffic yet; never round it up). Skip if there are none.
2. **Top fix.** Call `get_top_fix`.
   - A finding came back: follow steps 3 to 5 of `/userproof:review` (find the code, present the fix with the tool's evidence and cost, mark it applied only after it is live).
   - `quota_exceeded`: show the upgrade link once and stop.
3. **No finding passes the bar.** The same result ends with a funnel read. Do not stop at "nothing found". Give:
   - The biggest visible leak in one line, labeled **a lead, not proof**.
   - The entry pages and sources it came from, and the coverage line (sessions recorded against the total in their other analytics, if you can see it). A large gap is a finding of its own: say the snippet is missing somewhere.
   - Then look at that page in this repo and say what you would test, as a hypothesis. Do not edit code for a lead unless the user says to.
4. **End with one next action.** Whichever of: ship this fix, test this lead, set a goal (if none), or fix the snippet coverage.

Rules:
- Numbers come only from tool output. No estimates or projections of your own.
- A lead is never called a fix, never marked applied, and never gets a dollar figure.
- If a result mentions a stale or rejected API key, pass that note on first, with the exact line to remove.
