# shared

The names Nutshell, the board API, and the MCP servers use for the same ideas. Scopes, ticket statuses, actor types, event actions, database and collection names, and MCP tool names live here.

Import a constant instead of typing the string. A misspelled scope fails silently when it is a bare string. `SCOPES.TICKETS_WRITE` fails in the editor.

```ts
import { SCOPES, TICKET_STATUS } from "@/shared/names";
```

## Files

- `names.ts` is the TypeScript source for the Next.js app and the board API.
- `names.json` is the same list for code that is not TypeScript.

Change a name in both files, then update [docs/schema.md](../docs/schema.md). The board API keeps its own `src/names.ts` and it has to stay aligned with this folder.

Current scopes are `tickets:read`, `tickets:write`, `comments:write`, and `tickets:close`. Human tokens start with `usr_`. Agent tokens start with `clw_`. The default columns are `backlog`, `in_progress`, `in_review`, and `done`. The database name is `hackathon`.
