# NutShell demo script (3 minutes)

The story: **an AI agent did real work, a human stayed in charge.** Claude Code, acting for Raddy, built a feature (CLW-16, ticket search), linked its commits and asked for review. Raddy approves it and it moves to Done. Every step is on one board the whole team can see.

## Before you present (5 minutes)

1. Start the site and leave this Terminal window open:
   ```bash
   cd ~/Documents/GitHub/hackohio-2026/web && npm run dev
   ```
2. Open http://localhost:3000 in Chrome. Make the window full screen and zoom to 110–125% (Cmd +) so judges can read it.
3. Reload the page right before you start. The site uses sample data, so a reload puts CLW-16 back in "In review".
4. Light mode is the default. If the site is dark, open your name in the top right and pick "Light mode".
5. Optional, if judges use their own laptops: start ngrok in a second Terminal window (`ngrok http 3000 --region us`) and share the link.
6. Optional, to show the data really lives in MongoDB: open Compass on the `hackathon` database (cluster0.3pub20) in another window.

## Click-through

| Time | Click | Say |
|---|---|---|
| 0:00 | **Home** page | "Teams now work alongside AI agents, but nobody can see what those agents did. NutShell puts every human and agent action on one board." |
| 0:20 | Point at **Pending actions**: "Waiting on you · CLW-16 · Search tickets by id, title or tag" | "Raddy's agent finished a feature while he was away. It needs a human to approve it." |
| 0:35 | Click **Review** on CLW-16 | The ticket opens in the middle of the board. |
| 0:40 | Point at **Created by: AGENT Claude Code**, **Acting for: Raddy**, **Token scopes** | "Agents are never anonymous. Every agent belongs to a person, and its token only allows what that person allowed: here, write tickets and comment, but not close them." |
| 1:00 | Point at **Linked commits** | "The agent had to link its commits before it could move the ticket. That's one of our rules for agents." |
| 1:15 | Scroll to **Change history** (v1 → v5) | "Every change is a version, like Git: created, commit linked, moved to In progress, second commit, moved to In review. You can see who did each one." |
| 1:30 | Point at the agent's comment | "It even explains what it did." |
| 1:40 | Click **Approve** | The popup says "Approved CLW-16 · Moved to Done". |
| 1:45 | Press **Esc** to close | The card is now in **Done** and the top of **Live activity** says Raddy closed CLW-16. "A human made the final call, and it's on the record." |
| 1:50 | Click **Ask Nutty** (bottom right), then the suggestion **Move CLW-12 to In progress** | The card moves on the board and Live activity shows "Nutty · for Raddy". "You can also just ask. The assistant is an agent too, acting for me, so it's on the record like any other agent." |
| 1:55 | Type **approve CLW-16** | It says agents can't approve tickets: "Even our own assistant can't close tickets. That's the human's job." |
| 2:00 | Drag any Backlog card to **In progress** | "Humans use the same board: drag and drop, custom columns, tags." |
| 2:15 | Click the project name (**HackOHI/O build ⇅**), pick **Pitch & demo**, then open it again and pick **All projects** | "One team, many projects, each with its own board. Templates like Kanban or Bug tracker set up the columns for you." |
| 2:35 | Open **Agents** | "And you control every agent here: what it may do, and a Revoke button that cuts it off right away." |
| 2:50 | Back to the board | "NutShell: let agents do the work, and keep humans in charge." |

## If something goes wrong

- **Page shows "This site can't be reached":** the site stopped. Run step 1 again, then reload.
- **CLW-16 is already in Done:** reload the page (the sample data resets).
- **ngrok link fails on OSU Wi-Fi:** use `--region us` (step 5) or your phone's hotspot.
- **The assistant says "offline mode":** that's fine for the demo; it understands the suggestions shown in the chat. For real AI answers, set up AWS Bedrock (see below).
- **Anything else:** present from localhost on your own laptop. Everything in this script works without internet.

## Where the demo data lives

- **Website (now):** `web/lib/mock-data.ts`. The site shows this until Dylan's API is connected.
- **MongoDB:** `db/seed.js` has the same projects, tickets (including CLW-16), comments and events. To refresh the shared Atlas database with it (this replaces everyone's data there, so tell the team first):
  ```bash
  cd ~/Documents/GitHub/hackohio-2026 && npm run db:seed -- --allow-remote
  ```

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
