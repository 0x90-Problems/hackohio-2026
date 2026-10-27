# hackohio-2026

Nutshell, the HackOHI/O 2026 board. This is the product repository: the Next.js app people open, the Mongo seed data, and the local LLDAP directory used for sign-in during development.

People use it to see projects, move tickets, approve an agent's work, and connect an agent. Agents call the board through the MCP URL this app publishes. The ticket rules and the bearer tokens live in [0x90-NextJS-Backend](https://github.com/0x90-Problems/0x90-NextJS-Backend). The git changelog lives in [Buc2AgentNamespaceGitTracking](https://github.com/0x90-Problems/Buc2AgentNamespaceGitTracking). AWS for the directory, Redis, and the VPS lives in [Buc2AgentTerraform](https://github.com/0x90-Problems/Buc2AgentTerraform).

## Use

- Browse and edit the board at the Vercel app, [hackohio-2026-eta.vercel.app](https://hackohio-2026-eta.vercel.app).
- Sign in with an LLDAP user. The password is checked by the board API. This app does not store it.
- Give an agent `https://hackohio-2026-eta.vercel.app/mcp`. That route forwards the call, and the bearer, to the board API.
- Read the reports in [docs/architecture](docs/architecture), [docs/libraries](docs/libraries), and [docs/backend](docs/backend). The database shape is [docs/schema.md](docs/schema.md). The demo steps are [docs/demo-script.md](docs/demo-script.md).

## Run locally

Requires Node.js 22 and Docker.

```text
copy .env.example .env.local
npm install
docker compose --env-file .env.local up -d
npm run db:setup
npm run db:seed
cd web
npm install
npm run dev
```

Set `LLDAP_JWT_SECRET`, `LLDAP_KEY_SEED`, and `LLDAP_LDAP_USER_PASS` in `.env.local` before starting LLDAP. Two different `openssl rand -hex 32` values cover the first two. The admin UI is [http://localhost:17170](http://localhost:17170) and LDAP is `localhost:3890`. Create users whose usernames match `auth_username` in MongoDB (`dylan`, `raddy`, `naz`, `debora`).

`BOARD_API_URL` is the board API origin (AWS DocumentDB board). Login, signup, `/api/board`, and `/api/site` forward there. Point the web app at that origin from `web/.env.local`. `MONGODB_URI` is not required on Vercel after the DocDB cutover. Nutty, the in-app assistant, also needs AWS credentials and a region in `web/.env.local`. Without them the chat page uses the offline assistant.

`npm run demo:restore -- --as <username>` puts the CLW demo project back for a rehearsal. Add `--reset` to recreate it.

Stop the directory with `docker compose --env-file .env.local down`. Do not publish ports 3890 and 17170 on a public network. `data/lldap/` is local state and is not committed.

## Deploy

The site is the Vercel project for this repository. Production needs `BOARD_API_URL` set to the AWS board API (`https://um433hdwe5.execute-api.us-east-1.amazonaws.com`). Leave `MONGODB_URI` unset — Teams/Organization use `/api/site` → board, not Atlas. Set `NEXT_PUBLIC_MCP_URL` only when the install link should not be `https://hackohio-2026-eta.vercel.app/mcp`.

Bedrock credentials on Vercel turn Nutty on. The AWS tasks, LLDAP, Redis, and the git VPS are applied from Buc2AgentTerraform. This repository does not contain that stack.

Do not commit `.env.local` or any other `.env` file.

## License

Proprietary. Copyright 2026 0x90 Problems. All rights reserved.

[LICENSE](LICENSE) keeps this repository with the hackathon team. People outside the team may not use, copy, modify, or distribute it. Commercial use is prohibited unless the team agrees in writing first. This is not an open-source license.
