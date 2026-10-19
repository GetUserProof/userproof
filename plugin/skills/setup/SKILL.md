---
name: setup
description: Set up UserProof for this project from the terminal. It creates the account, adds the tracking snippet to the codebase, proves the snippet records, and runs a free scan of the live site for broken elements with the file and line. Use when the user installs the plugin, asks to set up UserProof or session recording, or asks what's broken on their site before they have traffic.
---

Take this user from nothing to "UserProof is recording", proven, with the site's goal set, in a few minutes, without them opening a dashboard. Then run the free scan as a bonus. The big moment comes later: the first finding from their real visitors, ranked by what it costs the goal.

**How to ask:** look first, then ask everything in **one** AskUserQuestion call (up to 4 questions), then do the whole setup without stopping to ask again. Never ask a question you could answer from the repo.

Everything here goes over plain HTTP, so it works before the MCP has a key:

```bash
API="${USERPROOF_API_URL:-https://api.getuserproof.com}"
K=$(cat ~/.config/userproof/key 2>/dev/null)   # set in step 1
```

Shell state doesn't persist between commands. Re-run those two lines in every command that calls the API.

## Step 0: already set up?

If `.userproof` has a `site_id` and `~/.config/userproof/key` exists, skip to step 4.

## Step 1: look, then ask once (about 1 minute)

**Look (no questions):**
1. **Live domain:** `metadataBase` or canonical URLs in the root layout, `homepage` in `package.json`, `CNAME`, `.vercel/project.json`, the first `https://` URL in `README.md`.
2. **Existing account:** does `~/.config/userproof/key` exist? Then skip the sign-in.
3. **Goal candidates:** Stripe or checkout links (`buy.stripe.com`, `checkout`), signup or contact forms and where they post, calendar links (`calendly`, `cal.com`), "thank you" or success pages, and the text of the main call-to-action buttons. Keep up to 3, with the exact button text as rendered (with an `uppercase` class, list both cases) or the success page path. Note any price you find.
4. **Where the snippet goes** (table in step 2), and whether an older tracking tag is already there.
5. **How the site deploys:** a `vercel.json`/`.vercel`, `netlify.toml` or similar plus a git remote means a push deploys it.

**Ask once.** One AskUserQuestion call with these questions, skipping any the repo already answered:
- **Goal:** "What's the one thing visitors should do on <domain>?" Options: your candidates, e.g. "Click 'Book a call'", "Reach /thank-you". The user can type another.
- **Value:** "What is one <goal> worth, roughly?" Options: the price you found if any, "Skip for now". If the repo serves several domains, ask "Which site should UserProof record?" here instead and skip the value.
- **Deploy:** "When setup is done, should I commit and push so it goes live?" Options: "Yes, commit and push", "No, I'll deploy it".

Echo the answers back in one line, then run steps 1a to 5 without asking anything else. (Signing in, in step 1a, isn't a question: it's a link they open.)

## Step 1a: account

1. **Existing key:** add this site to the account instead of signing up (signing up again would replace the key):

```bash
curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{"domain":"THEIR_DOMAIN"}' "$API/v2/sites"
```

   A `site_limit` result means the Free plan's 3 sites are taken: show its `upgrade_url` on its own line and stop.

2. **No key yet: sign in.** Start a sign-in and show the link. The person signs in on getuserproof.com with GitHub, Google or an emailed link and approves the code; nobody types an email into the terminal.

```bash
mkdir -p ~/.config/userproof
curl -s -X POST "$API/v2/connect/start" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
require("fs").writeFileSync(require("os").homedir()+"/.config/userproof/.connect",j.poll_token,{mode:0o600});
console.log(j.text)})'
```

   Show the user the printed line exactly (the link and the code), then wait for them to approve. This waits on a person, so it's fine to loop, up to 10 minutes:

```bash
for i in $(seq 1 12); do
  R=$(curl -s -X POST "$API/v2/connect/poll" -H 'Content-Type: application/json' \
    -d "{\"poll_token\":\"$(cat ~/.config/userproof/.connect)\",\"wait\":50}")
  echo "$R" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
  if(j.user_api_key){const f=require("os").homedir()+"/.config/userproof/key";require("fs").writeFileSync(f,j.user_api_key+"\n",{mode:0o600});
  require("fs").rmSync(require("os").homedir()+"/.config/userproof/.connect",{force:true});console.log("signed in as "+j.email);process.exit(0)}
  console.log(j.status);process.exit(j.status==="pending"?1:2)})' && break
  [ $? -eq 2 ] && break
done
```

   `signed in as …` means the key is saved. `expired` means start again. Then add the site with the item 1 command (the new account has no sites yet).

3. **Record the site.** Write `{"site_id": "...", "domain": "...", "fixes": []}` to `.userproof`. Tell the user the key is in `~/.config/userproof/key` (the MCP tools read it themselves after a Claude Code restart). Don't print the key.
4. **Signing in with an email that already has an account** connects to that account and adds a key for this machine.

## Step 2: the snippet (about 1 minute)

Put `snippet` in the site's `<head>`. Use the first layout that exists:

| Framework | File |
|---|---|
| Next.js App Router | `app/layout.*` or `src/app/layout.*`: a `<script>` inside `<head>` |
| Next.js Pages Router | `pages/_document.*`: inside `<Head>` |
| Vite / CRA / static | `index.html` or `public/index.html`: before `</head>` |
| Astro | `src/layouts/*.astro` |
| SvelteKit | `src/app.html` |
| Nuxt | `nuxt.config.*` under `app.head.script` |
| Rails | `app/views/layouts/application.html.erb` |

1. **Old tag:** if an older tracking tag for this product is already there (a `<script>` whose src ends in `/sdk.js` with a `data-site`), replace it rather than adding a second one. Call it "the old tracking tag"; don't name the old product.
2. **Write it** (running setup is the go-ahead), and show the diff in the summary.
3. **JSX:** attribute names stay the same (`data-site`, `data-api`, `defer`).

## Step 3: prove it records (about 2 minutes)

The snippet only sees live traffic after a deploy. Before that, prove it works locally. Pick 3a or 3b and stop at the first one that works.

**3a. Local dev server (preferred):**
1. Start the dev server in the background on a free port, for example `npm run dev -- -p 3123`. Save the PID (`echo $!`).
2. Wait until the port answers, at most 90 seconds.
3. Open `http://localhost:3123/` with the Playwright MCP (`browser_navigate`) and click any link or button once.
4. Wait for the event:

```bash
curl -s -H "Authorization: Bearer $K" "$API/v2/first-event?site_id=SITE_ID&wait=60"
```

5. `status: "received"` with `env: "dev"` proves the snippet in this code records. Stop the dev server by its PID.

**3b. If the dev server won't start** (missing env vars, a build error, or over 3 minutes): run a setup check on the live page.
1. Open the live URL with the Playwright MCP.
2. Run `browser_evaluate` with:

```js
() => { const s = document.createElement('script'); s.src = '<ingest>/sdk.js'; s.dataset.site = '<site_id>'; s.dataset.api = '<ingest>'; s.dataset.wulEnv = 'verify'; document.head.appendChild(s); }
```

   Take `<ingest>` from the snippet's `src` origin.
3. Click once, then call first-event as in 3a. `env: "verify"` proves the SDK runs on their live page. Say plainly that the code change itself is proven after deploy.

**If nothing arrives:** first-event returns `hints`. Act on the first hint, then retry once. Never report "recording" without a `received` status.

**This is the first-value moment.** Say it in this shape:

> **UserProof is recording** (event received from `<localhost or live page>`, env `<dev|verify>`).
> Once this is deployed, I'll pull your first finding from real visitors: where they get stuck on the way to your goal, and the file:line to fix. Next time you open Claude Code here, UserProof will tell you in one line when there's something new.
> While we wait, I'll run a free scan of the live site for anything broken right now.

## Step 3b: save the goal

Save the goal from step 1 (no new question):

```bash
curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{"site_id":"SITE_ID","name":"Book a call","kind":"click","matches":["Book a call","BOOK A CALL"]}' "$API/v2/goals"
```

`kind` is `click` (a click whose text or selector contains a match) or `page` (a visit to a path; end it with `*` for every path under it, like `/c/*`). Add `"value_usd": 29` if they gave a value. Say back what it returns in one line.

## Step 3c: deploy (only if they said yes)

Commit only the snippet change and `.userproof` with a short message, and push. Then check the live page **once**, in the background if your harness supports it (`curl -s <live url> | grep -c ingest.getuserproof.com`), and move on. Never wait or poll in the foreground for a deploy: if it isn't live yet, say it will show up when the deploy finishes. If they said no, leave the changes uncommitted and say what to deploy.

## Step 4: free scan of the live site (1-3 minutes)

```bash
S=$(curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{"site_id":"SITE_ID"}' "$API/v2/scan")
# then wait for it (the API holds the request up to 60 s; at most 3 calls):
curl -s -H "Authorization: Bearer $K" "$API/v2/scan?scan_id=SCAN_ID&wait=60"
```

The scan is read-only and labelled "scan". It finds things that are broken. It does not show that visitors hit them.

**If it finds no defects**, say "The scan found nothing broken on the live site" in one line, skip steps 5-6, and end with the real-visitor promise from step 3. Don't hunt for a weaker defect to have something to show.

## Step 4a: the goal check

When the site has a goal, the scan response starts with a **GOAL CHECK** line: we walked the goal on a phone and a desktop (is it there, above the first screen, not covered, does clicking it lead somewhere, page speed, errors, sideways scrolling on phones). Report it first, one line per problem, most serious first. A goal problem outranks any other scan defect: it is the defect, and steps 5-6 apply to it (its `top_defect` carries the element for the locator).

## Step 4b: goal-page review (from the code, about 2 minutes)

Their goal page is the page where the goal button or form lives (or the page that leads to the goal path). Read its code and score it against this checklist. Only flag what the code actually shows:

1. **One clear next step.** One primary call to action per screen; the label says the outcome ("Start my free trial", not "Submit"). Competing buttons of equal weight count against it.
2. **First screen.** The headline says what it is and who it's for; the goal button is visible without scrolling at 390px and 1366px wide (use the goal check's result).
3. **Friction.** Form fields: more than 3 at the top of the funnel, required fields that aren't needed, an account or card required before any value.
4. **Reassurance next to the button.** Price or "free", "no card", what happens next. Only real claims; never suggest inventing proof.
5. **Speed.** Hero images over 300 KB, render-blocking scripts in `<head>`, more than 2 font families, many third-party scripts.
6. **Phone.** Tap targets under 44px, fixed bars or popups that cover content, text under 16px in inputs.
7. **Dead ends.** Pages on the way to the goal without a link to the next step.

Present the top 3 at most, each as: the problem in one line, `file:line`, the exact change. Label the block **"Review (best practice, not yet proven by your visitors)"**. Offer to apply them; after they ship, `mark_fix_applied` and the goal rate later says whether it helped. Don't pad: if the page is in good shape, say so in one line.

## Step 5: find the code

1. Save `top_defect` from the scan response to a temp file and run the locator on it. The file carries the element's class list, id, href and where its text came from, so it beats a text search:

```bash
curl -s -H "Authorization: Bearer $K" "$API/v2/scan?scan_id=SCAN_ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>require("fs").writeFileSync("/tmp/userproof-defect.json",JSON.stringify(JSON.parse(s).top_defect)))'
node "${CLAUDE_PLUGIN_ROOT}/bin/userproof-locate.mjs" --repo . --defect /tmp/userproof-defect.json
```

2. Open the `best` file at its line and confirm it renders that element.
3. Check the element is really broken in the code:
   - A clickable-looking element with no handler is broken.
   - A handler that awaits something slow explains a slow response.
   - A link to a route that doesn't exist explains a 404.
4. If the code shows the scan is wrong, for example a handler the browser couldn't trigger, say so and take the next defect from `other_defects`. Do not fix a non-problem.
5. If the locator returns nothing, search with Grep for the element text and the page's route file before giving up.

## Step 6: present the scan defect

Say exactly this shape, and nothing longer:

> **[Defect in one line]** (found by our scan, 3 of 3 tries)
> `path/to/file.tsx:42`
> Fix: [the exact change, as a diff]
> After you deploy it, I'll re-test it on the live site; visitor data confirms it once traffic comes in.

Then:
1. Add `{ "defect_id": "...", "file": "...", "line": N }` to `fixes` in `.userproof`.
2. Offer the fix as the last line ("Want me to apply it?"). This is the only question after step 1, and it's optional.
3. If a dev server works, `check_fix` with `url=http://localhost:PORT` shows the fix works before deploy.
4. After the user deploys:
   - call `POST $API/v2/fix-applied` with `{"finding_id":"<defect id>"}`;
   - then `GET $API/v2/check-fix?finding_id=<defect id>`.
   - "Verified on the live site" counts toward activation (time to first verified fix). Say it plainly.

## Rules

- **One round of questions** (step 1), all in one AskUserQuestion call. After that, no questions until the optional fix offer at the end.
- **No foreground waiting:** never loop or sleep waiting for a deploy, a build or traffic. One check, then move on.
- **Key handling:** never print the API key. It lives only in `~/.config/userproof/key`, never in the repo or a commit.
- **Processes:** stop only the dev server you started, by its PID.
- **Numbers:** they come from the API responses only. Don't add estimates.
- **No traffic yet:** don't call get_top_fix before the site has live traffic. On day one it will find nothing.
