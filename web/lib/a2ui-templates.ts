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
      version: "1.0",
      components: [
        { id: "root", component: "Card", child: "body" },
        { id: "body", component: "Column", children: ["title", "summary"] },
        text("title", "### Release candidate ready"),
        text("summary", "All checks pass. **Two** known issues are listed on the ticket."),
      ],
    },
  },
  {
    id: "details",
    name: "Details pop-up",
    description: "A short line, with a button that opens the full details in a pop-up.",
    block: {
      version: "1.0",
      components: [
        { id: "root", component: "Column", children: ["summary", "details"] },
        text("summary", "Load test finished: p95 is **240 ms**."),
        { id: "details", component: "Modal", trigger: "open", content: "details_body" },
        { id: "open", component: "Button", child: "open_label", action: { event: { name: "open" } } },
        text("open_label", "Show details"),
        { id: "details_body", component: "Column", children: ["details_title", "details_text"] },
        text("details_title", "### Load test results"),
        text("details_text", "- 500 users for 10 minutes\n- p50 **110 ms**, p95 **240 ms**\n- No errors"),
      ],
    },
  },
  {
    id: "tabs",
    name: "Tabs",
    description: "Several views of the same thing, one per tab.",
    block: {
      version: "1.0",
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
      version: "1.0",
      components: [
        { id: "root", component: "List", children: ["step_1", "step_2", "step_3"] },
        { id: "step_1", component: "Row", align: "center", children: ["step_1_icon", "step_1_text"] },
        { id: "step_1_icon", component: "Icon", name: "check" },
        text("step_1_text", "Write the migration"),
        { id: "step_2", component: "Row", align: "center", children: ["step_2_icon", "step_2_text"] },
        { id: "step_2_icon", component: "Icon", name: "check" },
        text("step_2_text", "Run it on staging"),
        { id: "step_3", component: "Row", align: "center", children: ["step_3_icon", "step_3_text"] },
        { id: "step_3_icon", component: "Icon", name: "close" },
        text("step_3_text", "Run it on production"),
      ],
    },
  },
  {
    id: "link",
    name: "Link button",
    description: "A button that opens an https link or a NutShell page.",
    block: {
      version: "1.0",
      components: [
        { id: "root", component: "Row", align: "center", children: ["note", "go"] },
        text("note", "The design review is ready."),
        { id: "go", component: "Button", child: "go_label", action: { functionCall: { "@call": "openUrl", args: { url: "https://github.com/0x90-Problems" } } } },
        text("go_label", "Open"),
      ],
    },
  },
]

/** A template's JSON as shown in the editor. */
export function templateJson(template: BlockTemplate): string {
  return JSON.stringify(template.block, null, 2)
}
