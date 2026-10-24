# shared/

One place for every name the whole team uses: token scopes, token claims,
ticket statuses, actor types, event actions, database and collection names,
and MCP tool names.

## Rule

Never type one of these names by hand in your code. Import it:

```ts
import { SCOPES, TICKET_STATUS } from "@/shared/names";

if (token.scopes.includes(SCOPES.TICKETS_WRITE)) { ... }
```

A typo like `"ticket:write"` silently fails. `SCOPES.TICKET_WRITE` gets a red
error in VS Code right away.

## Files

- `names.ts` — the main file, for the Next.js app and the backend.
- `names.json` — the same names for anything that isn't TypeScript.

To change a name, edit both files, update `docs/schema.md`, and tell the team.

## Still to confirm with Dylan

- Are the scope names and status words final?
- Do the MCP tool names match what the MCP server uses?
- Token prefix `clw_` OK?
