// Ready-made A2UI blocks for the comment block editor (NSB-90). Each one passes checkBlock; edit the
// JSON to make it your own. Dependency-free so node --test can load it.

import type { A2uiBlock } from "./a2ui-block.ts"

export type BlockTemplate = { id: string; name: string; description: string; block: A2uiBlock }

const text = (id: string, value: string, variant?: string) => ({ id, component: "Text", text: value, ...(variant ? { variant } : {}) })

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: "card",
    name: "Card",
    description: "A titled box with a short summary.",
    block: {
      version: "v0.9",
      components: [
        { id: "root", component: "Card", child: "body" },
        { id: "body", component: "Column", children: ["title", "summary"] },
        text("title", "Release candidate ready", "h3"),
        text("summary", "All checks pass. **Two** known issues are listed on the ticket."),
      ],
    },
  },
  {
    id: "details",
    name: "Details pop-up",
    description: "A short line, with a button that opens the full details in a pop-up.",
    block: {
      version: "v0.9",
      components: [
        { id: "root", component: "Column", children: ["summary", "details"] },
        text("summary", "Load test finished: p95 is **240 ms**."),
        { id: "details", component: "Modal", trigger: "open", content: "details-body" },
        { id: "open", component: "Button", child: "open-label", action: { event: { name: "open" } } },
        text("open-label", "Show details"),
        { id: "details-body", component: "Column", children: ["details-title", "details-text"] },
        text("details-title", "Load test results", "h3"),
        text("details-text", "- 500 users for 10 minutes\n- p50 **110 ms**, p95 **240 ms**\n- No errors"),
      ],
    },
  },
  {
    id: "tabs",
    name: "Tabs",
    description: "Several views of the same thing, one per tab.",
    block: {
      version: "v0.9",
      components: [
        { id: "root", component: "Tabs", tabs: [{ title: "Summary", child: "summary" }, { title: "Risks", child: "risks" }] },
        text("summary", "Moves file uploads to the new storage."),
        text("risks", "- Old links stop working after 30 days\n- Needs a deploy of the files service"),
      ],
    },
  },
  {
    id: "checklist",
    name: "Checklist",
    description: "Steps with done and not-done marks.",
    block: {
      version: "v0.9",
      components: [
        { id: "root", component: "List", children: ["step-1", "step-2", "step-3"] },
        { id: "step-1", component: "Row", align: "center", children: ["step-1-icon", "step-1-text"] },
        { id: "step-1-icon", component: "Icon", name: "check" },
        text("step-1-text", "Write the migration"),
        { id: "step-2", component: "Row", align: "center", children: ["step-2-icon", "step-2-text"] },
        { id: "step-2-icon", component: "Icon", name: "check" },
        text("step-2-text", "Run it on staging"),
        { id: "step-3", component: "Row", align: "center", children: ["step-3-icon", "step-3-text"] },
        { id: "step-3-icon", component: "Icon", name: "close" },
        text("step-3-text", "Run it on production"),
      ],
    },
  },
  {
    id: "link",
    name: "Link button",
    description: "A button that opens an https link or a NutShell page.",
    block: {
      version: "v0.9",
      components: [
        { id: "root", component: "Row", align: "center", children: ["note", "go"] },
        text("note", "The design review is ready."),
        { id: "go", component: "Button", child: "go-label", action: { functionCall: { call: "openUrl", args: { url: "https://github.com/0x90-Problems" } } } },
        text("go-label", "Open"),
      ],
    },
  },
]

/** A template's JSON as shown in the editor. */
export function templateJson(template: BlockTemplate): string {
  return JSON.stringify(template.block, null, 2)
}
