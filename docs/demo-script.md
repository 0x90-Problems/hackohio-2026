# NutShell demo script (3 minutes)

The story: **an AI agent did real work, a human stayed in charge.** Claude Code, acting for the presenter, built a feature (CLW-16, ticket search), linked its commits and asked for review. The presenter approves it and it moves to Done. Every step is on one board the whole team can see.

Present from the **live site**: https://hackohio-2026.vercel.app (it needs internet; sign-in and the board live online now).

## Before you present (10 minutes)

1. **Reset the demo project.** The board saves to MongoDB, so a rehearsal really approves CLW-16. This puts project CLW (HackOHI/O build) back as new and touches nothing else:
   ```bash
   cd ~/Documents/GitHub/hackohio-2026 && npm run demo:restore -- --as raddyratt --reset
   ```
   Use the presenter's username after `--as`. It makes them CLW-16's reviewer and the owner of its "Claude Code" agent.
2. Open https://hackohio-2026.vercel.app in Chrome and **sign in as the presenter**. Stay in this tab: sign-in is per tab.
3. Make the window full screen and zoom to 110–125% (Cmd +) so judges can read it.
4. Light mode is the default. If the site is dark, open your name in the top right and pick "Light mode".
5. Check that **Home → Pending actions** shows "Waiting on you · CLW-16". If not, run step 1 again and reload.
6. Have the backup video ready (see "If something goes wrong").

## Click-through

| Time | Click | Say |
|---|---|---|
| 0:00 | **Home** page | "Teams now work alongside AI agents, but nobody can see what those agents did. NutShell puts every human and agent action on one board." |
| 0:20 | Point at **Pending actions**: "Waiting on you · CLW-16 · Search tickets by id, title or tag" | "My agent finished a feature while I was away. It needs a human to approve it." |
| 0:35 | Click **Review** on CLW-16 | The ticket opens in the middle of the board. |
| 0:40 | Point at **Created by: AGENT Claude Code**, **Acting for** you, **Token scopes** | "Agents are never anonymous. Every agent belongs to a person, and its token only allows what that person allowed: here, write tickets and comment, but not close them." |
| 0:55 | Click the **agent's owner name** ("for …") | A profile pops up: the activity graph and the **agent tree**, the person with every agent acting for them. "Anyone on the team can see whose agents did what." Close it. |
| 1:05 | Point at **Linked commits** | "The agent had to link its commits before it could move the ticket. That's one of our rules for agents." |
| 1:15 | Scroll to **Change history** (v1 → v5) | "Every change is a version, like Git: created, commit linked, moved to In progress, second commit, moved to In review. You can see who did each one." |
| 1:30 | Point at the agent's comment | "It even explains what it did." |
| 1:40 | Click **Approve** | The popup says "Approved CLW-16 · Moved to Done". |
| 1:45 | Press **Esc** to close | The card is now in **Done** and the top of **Live activity** says you closed CLW-16. "A human made the final call, and it's on the record." |
| 1:50 | Click **Ask Nutty** (bottom right), then the suggestion **Move CLW-12 to In progress** | The card moves on the board and Live activity shows "Nutty · for" you. "You can also just ask. The assistant is an agent too, acting for me, so it's on the record like any other agent." |
| 1:55 | Type **approve CLW-16** | It says agents can't approve tickets: "Even our own assistant can't close tickets. That's the human's job." |
| 2:00 | Drag a Backlog card (e.g. CLW-13) to **In progress** | "Humans use the same board: drag and drop, custom columns, tags." |
| 2:15 | Click the project name (**HackOHI/O build ⇅**), pick **Pitch & demo**, then open it again and pick **All projects** | "One team, many projects, each with its own board. Templates like Kanban or Bug tracker set up the columns for you." |
| 2:35 | Open **Agents**, point at **your** Claude Code row and its **Revoke** button (don't click it: it would cut off the demo agent until the next reset) | "And you control your agents here: what each may do, and a Revoke button that cuts it off right away. Only the owner can revoke their own agent." |
| 2:50 | Back to the board | "NutShell: let agents do the work, and keep humans in charge." |

## If something goes wrong

- **CLW-16 is already in Done, or "Waiting on you" is empty:** run step 1 (`npm run demo:restore -- --as <username> --reset`), then reload.
- **"Directory sign-in is not configured":** you're on a preview link, not the live site. Use https://hackohio-2026.vercel.app.
- **The site won't load (OSU Wi-Fi):** switch to your phone's hotspot. The site needs internet for sign-in and the board.
- **Nutty says "offline mode":** that's expected on the live site; it still understands the suggestions shown in the chat.
- **Anything else:** play the backup video. Localhost is no longer a fallback: it needs the same online sign-in.

## Where the demo data lives

- **The demo project (CLW):** defined in `db/sample-data.js` and added by `npm run demo:restore`, which only writes project CLW and the presenter's demo agent.
- **Everything else:** your team's real projects in the shared MongoDB (cluster0.3pub20). `npm run db:seed -- --allow-remote` would replace **all** of it with sample data, so don't run that without asking the team.

## Real AI for the assistant (optional)

Nutty runs Amazon Nova Pro on Amazon Bedrock (model `us.amazon.nova-pro-v1:0`) through the AWS SDK's Converse API, billed to the OSU AWS sandbox account. No Anthropic or Claude account is used. Without AWS settings the chat runs in offline mode.

Why Nova: the OSU sandbox (ISB Student 92) can't reliably run Claude models, because they need an AWS Marketplace subscription that the sandbox role isn't allowed to accept. Amazon's own models need none. To try another Bedrock model, set `BEDROCK_MODEL_ID` in `web/.env.local`.

To turn it on:

1. Sign in through AWS SSO (the `nutshell` profile is already in `~/.aws/config`). Sign-ins expire after a few hours; run this again whenever Nutty drops back to offline mode or shows a sign-in error:

   ```
   aws sso login --profile nutshell
   ```

2. `web/.env.local` needs just these two lines (no secrets), then restart `npm run dev`:

   ```
   AWS_REGION=us-east-1
   AWS_PROFILE=nutshell-app
   ```

3. Optional: create a Bedrock Guardrail (Bedrock → Guardrails) and add `BEDROCK_GUARDRAIL_ID=...` and `BEDROCK_GUARDRAIL_VERSION=1` to the same file. Bedrock applies it to every question and reply.

The chat header then says "powered by Amazon Nova on AWS Bedrock". Never commit `web/.env.local`; git already ignores it.
