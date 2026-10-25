# Nutshell web app

The Next.js app inside [hackohio-2026](https://github.com/0x90-Problems/hackohio-2026). Pages cover the home feed, projects, the board, one ticket, agents, teams, organization, profile, and sign-in. Nutty, the assistant, is `/api/chat`.

The app reads and writes the Atlas board through `/api/board`. Sign-in and MCP are proxies: `/auth/login`, `/auth/signup`, and `/mcp` forward to `BOARD_API_URL` and do not keep a copy of the password.

## Run

From this directory, with Node.js 22:

```text
npm install
npm run dev
```

Put `MONGODB_URI` and `BOARD_API_URL` in `web/.env.local`. The root `.env.example` lists the directory variables used by Docker Compose. `NEXT_PUBLIC_MCP_URL` is optional. When it is unset, the API page offers `https://hackohio-2026.vercel.app/mcp`.

```text
npm test
npm run typecheck
npm run build
```

`npm test` checks the project templates. `npm run dev` is the local app. `npm start` serves a production build.

## Deploy

Vercel builds this app. The production environment needs the same `MONGODB_URI` and `BOARD_API_URL` as local. Add AWS credentials and `BEDROCK_MODEL_ID` only when Nutty should call Amazon Nova. `BEDROCK_GUARDRAIL_ID` turns the Bedrock guardrail on.

Components live in `components/`. Shared words such as scopes and status values come from `shared/names.ts` at the repository root. Import those constants instead of typing the strings.

## License

Proprietary. Copyright 2026 0x90 Problems. All rights reserved. The repository [LICENSE](../LICENSE) prohibits reuse outside the team and prohibits commercial use unless the team agrees in writing. This is not an open-source license.
