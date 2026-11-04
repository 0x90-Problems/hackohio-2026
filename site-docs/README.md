# NutShell docs site

The public docs for NutShell: the REST board API (programs, scripts, CI) and MCP (AI agents). Built with [Zensical](https://zensical.org).

This folder is separate from the web app. Vercel doesn't build it, and nothing in `web/` reads it. The repository's `docs/` folder still holds the internal reports (architecture PDFs, `schema.md`, wireframes). They are not part of this site.

## Build

Needs Python 3.11 or newer.

```text
cd site-docs
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      (macOS, Linux: .venv/bin/pip)
.venv/Scripts/zensical build --strict              (or: zensical serve, to preview)
```

The site goes to `site-docs/site/`, which is not committed.

## MCP tool reference

`docs/mcp/tools.md` is generated. Don't edit it by hand. To refresh it from the live gateway:

```text
set NUTSHELL_TOKEN=clw_...                          (macOS, Linux: export NUTSHELL_TOKEN=clw_...)
python scripts/gen-mcp-tools.py --fetch --check
```

`--fetch` saves the gateway's `tools/list` answer to `data/mcp-tools.json`. The token is only sent in the request header. It is not printed or saved. `--check` lists tools whose descriptions or inputs need work. Fix those at the source, in `0x90-NextJS-Backend/src/mcp-http.ts`, then refresh.

## Pages

| File | Page |
| --- | --- |
| `docs/index.md` | Overview: the two ways in |
| `docs/api/index.md` | API: base URL, tokens, scopes, errors, rate limits |
| `docs/api/endpoints.md` | API endpoints with curl examples |
| `docs/mcp/index.md` | MCP: connecting clients, scopes, pausing, limits, troubleshooting |
| `docs/mcp/tools.md` | MCP tool reference (generated) |
