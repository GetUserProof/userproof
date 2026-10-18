---
name: review
description: Run a UserProof review of this project. It returns the one highest-impact fix proven by real visitor sessions, with dollar math when a conversion event is set. It then finds the code to change and later checks whether the fix worked. Use when the user wants to know what's hurting conversion, why users leave, or what UX work to do next.
---

Run a UserProof review of this project using the userproof MCP tools.

If the tools are unavailable, or answer that no API key is configured, the plugin is not set up yet. Run `/userproof:setup` instead and stop.

The active site comes from `.userproof` (`site_id`; the legacy `.whyusersleave` also works). If the tools say there is no active site, call `select_site`, then save the choice to `.userproof` as `{"site_id": "...", "domain": "...", "fixes": []}`.

Flow:

1. **Check earlier fixes.** If `.userproof` lists fixes marked applied earlier, call `check_fix` for each. Report the signal and conversion verdicts exactly as returned.
   - "inconclusive" means there isn't enough traffic yet. Say so, and don't round it up to "fixed".
2. **Get the top fix.** Call `get_top_fix`. It uses one monthly analysis.
   - If it returns `quota_exceeded`, show the upgrade link once, on its own line, say when the count resets, and stop.
   - Do not call it again until the user says they upgraded or the month resets.
3. **Find the code.** Locate the exact file and element in this repo that the finding names, using page, element text and selector. If the code shows the finding is wrong (for example, the element has a working handler the data could not see), say that plainly and stop. Do not fix a non-problem.
4. **Present:**
   - The fix in one line.
   - The evidence: sessions affected out of page sessions.
   - The cost, quoted exactly from the tool with its math. Never invent or adjust a dollar figure. If the tool gave none, say why it gave none.
   - The exact code change, as a diff.
5. **After the user approves and the change is live in production:**
   - Call `mark_fix_applied` with the finding id.
   - Add `{ "finding_id": "...", "file": "...", "line": N }` to `fixes` in `.userproof`.
   - Tell the user `check_fix` will have an answer once about 30 human visits have hit the page. Call it again later.

Rules:
- Numbers come only from tool output. Do not add estimates, percentages or projections of your own.
- If the response says no conversion event is set, say that dollar figures stay off until one exists.
