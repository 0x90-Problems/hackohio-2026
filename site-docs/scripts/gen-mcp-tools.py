"""Build the MCP tool reference page from a saved tools/list response.

Usage (from site-docs/):

    python scripts/gen-mcp-tools.py            # data/mcp-tools.json -> docs/mcp/tools.md
    python scripts/gen-mcp-tools.py --check    # also list tools whose descriptions need work
    python scripts/gen-mcp-tools.py --fetch    # refresh data/mcp-tools.json from the gateway first

--fetch reads an agent token from the NUTSHELL_TOKEN environment variable. The token is
sent only in the Authorization header. It is never printed or written to a file.
The saved JSON holds the tool list only, so it is safe to commit.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "mcp-tools.json"
PAGE = ROOT / "docs" / "mcp" / "tools.md"
GATEWAY = "https://gisecl2xck.execute-api.us-east-1.amazonaws.com/mcp"

# Areas, in page order. A tool goes in the first area whose test matches.
AREAS: list[tuple[str, str, object]] = [
    ("Tickets and projects", "Read the board, change tickets, and make projects.", {
        "get_board", "create_ticket", "move_ticket", "delete_ticket", "add_comment", "link_commit",
        "watch_changes", "read_comments", "list_project_templates", "get_project_template",
        "get_project_table", "create_project",
    }),
    ("Agent control", "Pause and resume agents. People only.", {"pause_agents", "resume_agents"}),
    ("Ticket chat (older)", "Listed only while the older ticket chat is on.", {
        "post_message", "list_messages", "wait_for_mentions", "ack_mention", "list_channels",
    }),
    ("Workspace chat", "Channels, threads and messages for your team.", lambda n: n.startswith("chat_")),
    ("Folders", "Browse and arrange your team's folders.", lambda n: n.endswith("_folder")),
    ("Notes and files", "Markdown notes, uploads, versions and downloads.", {
        "read_note", "create_note", "update_note", "list_versions", "get_file_link", "request_upload",
        "upload_status", "file_diff", "search_files",
    }),
    ("Files on tickets", "Link files and notes to tickets.", {
        "list_file_links", "list_ticket_files", "link_file_to_ticket", "unlink_file_from_ticket",
    }),
    ("Whiteboard", "Read, draw on, save and look at whiteboards.", lambda n: n.startswith("wb_")),
]

SHORT_DESCRIPTION = 80  # characters; shorter than this is flagged as too short


def area_of(name: str) -> str:
    for title, _, test in AREAS:
        if (callable(test) and test(name)) or (isinstance(test, set) and name in test):
            return title
    return "Other"


def fetch() -> None:
    token = os.environ.get("NUTSHELL_TOKEN")
    if not token:
        sys.exit("Set NUTSHELL_TOKEN to an agent token first.")
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).encode()
    request = urllib.request.Request(GATEWAY, data=body, method="POST", headers={
        "authorization": "Bearer " + token,
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
    })
    with urllib.request.urlopen(request, timeout=60) as response:
        tools = json.loads(response.read().decode())["result"]["tools"]
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps({"tools": tools}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(tools)} tools to {DATA.relative_to(ROOT)}")


def type_of(schema: dict) -> str:
    kind = schema.get("type", "any")
    kinds = kind if isinstance(kind, list) else [kind]
    kinds = [k for k in kinds if k != "null"] or ["null"]
    text = " or ".join(kinds)
    if "array" in kinds and isinstance(schema.get("items"), dict):
        text = f"array of {type_of(schema['items'])}"
        if schema["items"].get("type") == "object":
            text = "array of objects"
    if schema.get("enum"):
        text += " (" + ", ".join(f"`{v}`" for v in schema["enum"]) + ")"
    if schema.get("maxItems"):
        text += f", at most {schema['maxItems']}"
    return text


def cell(text: str) -> str:
    return " ".join(text.split()).replace("|", "\\|")


def problems(tool: dict) -> list[str]:
    found = []
    description = (tool.get("description") or "").strip()
    if not description:
        found.append("no description")
    elif len(description) < SHORT_DESCRIPTION:
        found.append(f"description is short ({len(description)} characters)")
    if description and "Requires" not in description and "Human-only" not in description:
        found.append("description doesn't name the scope it needs")
    props = tool.get("inputSchema", {}).get("properties", {})
    missing = [name for name, schema in props.items() if not (schema.get("description") or "").strip()]
    if missing:
        found.append(f"{len(missing)} of {len(props)} inputs have no description: " + ", ".join(missing))
    return found


def render(tools: list[dict]) -> str:
    grouped: dict[str, list[dict]] = {}
    for tool in tools:
        grouped.setdefault(area_of(tool["name"]), []).append(tool)
    order = [title for title, _, _ in AREAS if title in grouped] + (["Other"] if "Other" in grouped else [])
    blurbs = {title: blurb for title, blurb, _ in AREAS}

    lines = [
        "<!-- Generated by scripts/gen-mcp-tools.py from data/mcp-tools.json. Do not edit by hand. -->",
        "",
        "# MCP tool reference",
        "",
        f"The gateway lists {len(tools)} tools. This page is built from its `tools/list` answer, "
        "so the text is what your agent sees.",
        "",
        "Each tool says which scope it needs. A call without that scope returns `missing_scope` or `forbidden`. "
        "An input marked **yes** is required. A dash means the input has no description yet.",
        "",
    ]
    for title in order:
        lines += [f"## {title}", "", blurbs.get(title, ""), "", "| Tool | What it does |", "| --- | --- |"]
        for tool in grouped[title]:
            first = (tool.get("description") or "").split(". ")[0].rstrip(".")
            lines.append(f"| [`{tool['name']}`](#{tool['name']}) | {cell(first)}. |")
        lines.append("")
        for tool in grouped[title]:
            schema = tool.get("inputSchema", {})
            props = schema.get("properties", {})
            required = set(schema.get("required", []))
            lines += [f"### `{tool['name']}` {{ #{tool['name']} }}", "", tool.get("description") or "No description.", ""]
            if props:
                lines += ["| Input | Type | Required | Description |", "| --- | --- | --- | --- |"]
                for name, prop in props.items():
                    need = "yes" if name in required else "no"
                    lines.append(f"| `{name}` | {cell(type_of(prop))} | {need} | {cell(prop.get('description') or '-')} |")
            else:
                lines.append("No inputs.")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fetch", action="store_true", help="refresh data/mcp-tools.json from the gateway")
    parser.add_argument("--check", action="store_true", help="list tools whose descriptions need work")
    args = parser.parse_args()
    if args.fetch:
        fetch()
    tools = json.loads(DATA.read_text(encoding="utf-8"))["tools"]
    PAGE.parent.mkdir(parents=True, exist_ok=True)
    PAGE.write_text(render(tools), encoding="utf-8", newline="\n")
    print(f"Wrote {PAGE.relative_to(ROOT)} ({len(tools)} tools)")
    if args.check:
        flagged = [(tool["name"], problems(tool)) for tool in tools]
        flagged = [(name, found) for name, found in flagged if found]
        print(f"{len(flagged)} of {len(tools)} tools need work:")
        for name, found in flagged:
            print(f"- {name}: " + "; ".join(found))


if __name__ == "__main__":
    main()
