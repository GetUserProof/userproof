---
name: setup
description: Set up UserProof for this project from the terminal. It creates the account, adds the tracking snippet to the codebase, proves the snippet records, and runs a free scan of the live site for broken elements with the file and line. Use when the user installs the plugin, asks to set up UserProof or session recording, or asks what's broken on their site before they have traffic.
---

Take this user from nothing to "UserProof is recording", proven, with the site's goal set, in a few minutes, without them opening a dashboard. Then run the free scan as a bonus. The big moment comes later: the first finding from their real visitors, ranked by what it costs the goal.

**How to ask:** use your structured question tool (AskUserQuestion) whenever there are choices, with the options you found in the repo. Echo each answer back in one line before acting on it. At most four questions in the whole setup: email, site (only if the repo serves more than one), goal, and what a goal is worth (skippable).

Everything here goes over plain HTTP, so it works before the MCP has a key:

```bash
API="${USERPROOF_API_URL:-https://api.getuserproof.com}"
K=$(cat ~/.config/userproof/key 2>/dev/null)   # set in step 1
```

Shell state doesn't persist between commands. Re-run those two lines in every command that calls the API.

## Step 0: already set up?

If `.userproof` (or the legacy `.whyusersleave`) has a `site_id` and `~/.config/userproof/key` exists, skip to step 4.

## Step 1: account (about 1 minute)

1. **Find the live domain in the repo.** Don't ask for it. Check `metadataBase` or canonical URLs in the root layout, `homepage` in `package.json`, `CNAME`, `.vercel/project.json`, and the first `https://` URL in `README.md`.
2. **Already have a key?** If `~/.config/userproof/key` exists, don't sign up again (that would replace the key). Add this site to the account instead, then go to item 4:

```bash
curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{"domain":"THEIR_DOMAIN"}' "$API/v2/sites"
```

   A `site_limit` result means the Free plan's 3 sites are taken: show its `upgrade_url` on its own line, and when the user says they upgraded, run the same command again.

3. **Get an email.** Ask one question: **"What email should the account be on?"** Skip this if the user already gave one.
   **Create the account.** This one command saves the key straight to a file (mode 600) and prints everything except the key, so the key never lands in the transcript:

```bash
mkdir -p ~/.config/userproof
curl -s -X POST "$API/v2/signup" -H 'Content-Type: application/json' \
  -d '{"email":"THEIR_EMAIL","domain":"THEIR_DOMAIN"}' | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
if(!j.user_api_key){console.log(s);process.exit(1)}
const f=require("os").homedir()+"/.config/userproof/key";
require("fs").writeFileSync(f,j.user_api_key+"\n",{mode:0o600});
console.log(JSON.stringify({site:j.site,snippet:j.snippet,key_saved_to:f}))})'
```

4. **Record the site.** Write `{"site_id": "...", "domain": "...", "fixes": []}` to `.userproof`. Tell the user the key is in `~/.config/userproof/key`. The MCP tools read that file themselves, so nothing needs exporting; they work after a Claude Code restart (or a `/mcp` reconnect). Don't print the key.
5. **If it returns 409**, the email already has an account. Ask for the key and stop if they don't have it.

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

1. **Old snippet:** if an older tracking tag is already there (legacy `whyusersleave.com/sdk.js`), replace it rather than adding a second one.
2. **Show the diff, then write it.** Apply it after the user approves, or directly if they already asked you to set it up.
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

## Step 3b: the goal (about 1 minute)

The goal is the one thing visitors should do on this site. Everything UserProof says later is ranked by it.

1. **Find candidates in the code before asking.** Search for: Stripe or checkout links (`buy.stripe.com`, `checkout`), signup or contact forms and where they post, calendar links (`calendly`, `cal.com`), "thank you" or success pages, and the text of the main call-to-action buttons. Keep up to 3 real candidates, with the exact button text as rendered (check for `uppercase` classes: then list both cases) or the success page path.
2. **Ask once** with AskUserQuestion: "What's the one thing visitors should do on <domain>?" Options = your candidates, e.g. "Click 'Book a call' (pricing and home pages)", "Reach /thank-you after signup". The user can type another.
3. **Optional value:** ask "What is one <goal> worth, roughly?" with options from the code where possible (the Stripe price you found), plus "Skip for now". Skip means no dollar figures, nothing else.
4. **Save it:**

```bash
curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{"site_id":"SITE_ID","name":"Book a call","kind":"click","matches":["Book a call","BOOK A CALL"]}' "$API/v2/goals"
```

   `kind` is `click` (a click whose text or selector contains a match) or `page` (a visit to a path; end it with `*` for every path under it, like `/c/*`). Add `"value_usd": 29` if they gave a value. Say back what it returns in one line.

## Step 4: free scan of the live site (1-3 minutes)

```bash
S=$(curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{"site_id":"SITE_ID"}' "$API/v2/scan")
# then poll until status is done:
curl -s -H "Authorization: Bearer $K" "$API/v2/scan?scan_id=SCAN_ID&wait=60"
```

The scan is read-only and labelled "scan". It finds things that are broken. It does not show that visitors hit them.

**If it finds no defects**, say "The scan found nothing broken on the live site" in one line, skip steps 5-6, and end with the real-visitor promise from step 3. Don't hunt for a weaker defect to have something to show.

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
2. Only apply the fix if the user approves.
3. If a dev server works, `check_fix` with `url=http://localhost:PORT` shows the fix works before deploy.
4. After the user deploys:
   - call `POST $API/v2/fix-applied` with `{"finding_id":"<defect id>"}`;
   - then `GET $API/v2/check-fix?finding_id=<defect id>`.
   - "Verified on the live site" counts toward activation (time to first verified fix). Say it plainly.

## Rules

- **One question per turn.** The only questions are the email, the site if there are several, the goal, its value, and approval of the diff.
- **Key handling:** never print the API key. It lives only in `~/.config/userproof/key`, never in the repo or a commit.
- **Processes:** stop only the dev server you started, by its PID.
- **Numbers:** they come from the API responses only. Don't add estimates.
- **No traffic yet:** don't call get_top_fix before the site has live traffic. On day one it will find nothing.
