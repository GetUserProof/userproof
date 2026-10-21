# UserProof for Claude Code, Codex and Cursor

UserProof shows you the one fix your real visitors are begging for, with the file and line, then checks whether it worked after you ship. https://getuserproof.com

## Install

```
/plugin marketplace add GetUserProof/userproof
/plugin install userproof@userproof
/userproof:setup
```

### Codex

```
codex mcp add userproof -- npx -y github:GetUserProof/userproof
codex "Read https://getuserproof.com/setup.md and follow it to set up UserProof for this project."
```

### Cursor

Add to `~/.cursor/mcp.json` under `mcpServers`:

```json
"userproof": { "command": "npx", "args": ["-y", "github:GetUserProof/userproof"] }
```

Then ask the agent: "Read https://getuserproof.com/setup.md and follow it to set up UserProof for this project."

Setup creates your account, adds the tracking snippet to your site, and proves it records. After a Claude Code restart (or `/mcp` reconnect) run `/userproof:review` for the top fix.

## What data it collects

- Your email and site domain, sent to api.getuserproof.com at signup.
- Visitor behavior on your site (page views, clicks, scrolls, errors) sent by the snippet to ingest.getuserproof.com.
- The plugin itself reads only `.userproof` in your repo and your API key. The key is stored in `~/.config/userproof/key` (mode 600). It does not upload your source code.

No npm install is needed: the MCP server ships inside the plugin as one file (`plugin/mcp/server.mjs`, also run by `npx github:GetUserProof/userproof`) and needs Node 18+.
