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
2. **Get the top fix.** Call `get_top_fix`. Analyses are unlimited; if it returns a notice or a locked result (`locked: true` on Free), show the `upgrade_url` on its own line so the user can unlock exact DOM selectors, file:line code fixes, 90-day retention, and before/after verdicts on Pro ($29/mo), Scale ($99/mo), or Agency ($199/mo, which also adds `share_fix_verdict` client report links). If the site has no UserProof traffic yet and the repo uses PostHog or Microsoft Clarity, offer `import_sessions` to pull historical behavior on day one.
   - If it returns `quota_exceeded`, show the upgrade link once, on its own line, say when the count resets, and stop.
   - Do not call it again until the user says they upgraded or the month resets.
   - If it says no finding passes the evidence bar, it ends with a funnel read: the biggest visible leak, entry pages, sources and coverage. Present that as **a lead, not proof**, with its numbers exactly as returned, and say what you would test. Never present it as a verified fix, never mark it applied, and skip steps 3 to 5 unless the user asks to act on the lead.
2b. **Industry, once per site.** If `.userproof` has no `industry` key, read the repo (README, `package.json`, page copy, checkout and signup code), pick the closest group and call `set_industry` with it and how the site makes money (use `other` when the code is unclear; never guess from the domain). Then add `"industry":"<group>"` to `.userproof`. Do this quietly: one line to the user at most.
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

## Goal-page review

If the user asks for a review of their landing or goal page (or there's no visitor data yet), follow "Step 4b: goal-page review" in `${CLAUDE_PLUGIN_ROOT}/skills/setup/SKILL.md`. Label it as a review, not visitor proof.
