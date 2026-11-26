/**
 * A2UI blocks on comments (NSB-90): a small structured block (cards, lists, tabs, a pop-up with
 * details, NutShell images) that people and agents can add under a comment's text.
 *
 * Blocks use A2UI v1.0 components, but only the read-only subset below, with literal values (no
 * data bindings, templates or functions beyond opening a link). Blocks written for v0.9 (the
 * first version NutShell took) are still accepted and upgraded to v1.0 by upgradeBlock. Everything an agent or person
 * sends is checked here before it's stored; the web app checks it again before rendering.
 * Dependency-free so the web app can keep an identical copy (web/lib/a2ui-block.ts in the web app; src/a2ui-block.ts in the board backend).
 */

export const A2UI_VERSION = "1.0";
export const LEGACY_VERSION = "v0.9";
export const MAX_COMPONENTS = 100;
export const MAX_BLOCK_BYTES = 32_000;
export const MAX_TEXT = 4000;
export const MAX_LABEL = 200;
export const MAX_CHILDREN = 50;
export const MAX_TABS = 10;

export type A2uiComponent = { id: string; component: string } & Record<string, unknown>;
export type A2uiBlock = { version: typeof A2UI_VERSION; components: A2uiComponent[] };

export class BlockError extends Error {}

/** The A2UI components a comment block may use. */
export const ALLOWED_COMPONENTS = ["Text", "Image", "Icon", "Row", "Column", "List", "Card", "Tabs", "Modal", "Divider", "Button"]

// v1.0 ids are identifiers (UAX #31); NutShell takes the ASCII ones.
const ID = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ICON = /^[A-Za-z0-9]{1,40}$/;
// Images come only from NutShell's own signed-in file links: outside images would tell another
// site who viewed the comment.
const IMAGE_URL = /^\/api\/files\/fil_[0-9a-z]{6,40}\/view$/;
const EVENT_NAME = /^[A-Za-z0-9_.-]{1,40}$/;

const COMMON = ["id", "component", "@accessibility", "weight"];
const ALLOWED: Record<string, string[]> = {
  Text: [...COMMON, "text", "variant"],
  Image: [...COMMON, "url", "description", "fit", "variant"],
  Icon: [...COMMON, "name"],
  Row: [...COMMON, "children", "justify", "align"],
  Column: [...COMMON, "children", "justify", "align"],
  List: [...COMMON, "children", "direction", "align"],
  Card: [...COMMON, "child"],
  Tabs: [...COMMON, "tabs"],
  Modal: [...COMMON, "trigger", "content"],
  Divider: [...COMMON, "axis"],
  Button: [...COMMON, "child", "variant", "action"],
};
const ENUMS: Record<string, Record<string, readonly string[]>> = {
  Text: { variant: ["caption", "body"] },
  Image: { fit: ["contain", "cover", "fill", "none", "scaleDown"], variant: ["icon", "avatar", "smallFeature", "mediumFeature", "largeFeature", "header"] },
  Row: { justify: ["center", "end", "spaceAround", "spaceBetween", "spaceEvenly", "start", "stretch"], align: ["start", "center", "end", "stretch"] },
  Column: { justify: ["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly", "stretch"], align: ["center", "end", "start", "stretch"] },
  List: { direction: ["vertical", "horizontal"], align: ["start", "center", "end", "stretch"] },
  Divider: { axis: ["horizontal", "vertical"] },
  Button: { variant: ["default", "primary", "borderless"] },
};

const fail = (message: string): never => {
  throw new BlockError(message);
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function literal(value: unknown, where: string, max: number): string {
  if (typeof value !== "string") fail(`${where} must be plain text (@path bindings aren't allowed)`);
  const text = value as string;
  if (text.length > max) fail(`${where} is at most ${max} characters`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail(`${where} has control characters`);
  return text;
}

function ref(value: unknown, where: string): string {
  if (typeof value !== "string" || !ID.test(value)) fail(`${where} must be a component id: letters, digits and _, not starting with a digit`);
  return value as string;
}

/** An https link, or a page inside NutShell. The only thing a button may open. */
export function safeLink(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//") && !/^\/%(2f|5c)/i.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function checkAction(action: unknown, where: string): void {
  if (!isRecord(action)) fail(`${where}.action is required`);
  const act = action as Record<string, unknown>;
  const keys = Object.keys(act);
  if (keys.length !== 1) fail(`${where}.action must be one event or one openUrl call`);
  if (keys[0] === "event") {
    // A plain event does nothing in NutShell (nothing is sent back to an agent); it's how a
    // Modal's trigger button is written.
    const event = act.event;
    if (!isRecord(event) || Object.keys(event).some((key) => key !== "name") || typeof event.name !== "string" || !EVENT_NAME.test(event.name)) {
      fail(`${where}.action.event must be { "name": "open" } with no context`);
    }
    return;
  }
  if (keys[0] === "functionCall") {
    const call = act.functionCall;
    if (!isRecord(call) || call["@call"] !== "openUrl") fail(`${where}.action.functionCall may only call openUrl ({ "@call": "openUrl", "args": { "url": ... } })`);
    const fc = call as Record<string, unknown>;
    if (Object.keys(fc).some((key) => key !== "@call" && key !== "args")) fail(`${where}.action.functionCall has unknown fields`);
    const args = fc.args;
    if (!isRecord(args) || Object.keys(args).length !== 1 || typeof args.url !== "string" || !safeLink(args.url)) {
      fail(`${where} may only open an https link or a NutShell page`);
    }
    return;
  }
  fail(`${where}.action must be an event or a functionCall`);
}

function checkComponent(raw: unknown, index: number): { component: A2uiComponent; children: string[] } {
  if (!isRecord(raw)) fail(`components[${index}] must be an object`);
  const item = raw as Record<string, unknown>;
  const id = ref(item.id, `components[${index}].id`);
  const type = item.component;
  if (typeof type !== "string" || !(type in ALLOWED)) {
    fail(`${id}: component must be one of ${Object.keys(ALLOWED).join(", ")}`);
  }
  const kind = type as string;
  const where = `${id} (${kind})`;
  for (const key of Object.keys(item)) {
    if (!ALLOWED[kind]!.includes(key)) fail(`${where}: unknown field ${key}`);
  }
  for (const [field, values] of Object.entries(ENUMS[kind] ?? {})) {
    if (item[field] !== undefined && !values.includes(item[field] as string)) fail(`${where}: ${field} must be one of ${values.join(", ")}`);
  }
  if (item.weight !== undefined && (typeof item.weight !== "number" || !Number.isFinite(item.weight) || item.weight < 0 || item.weight > 100)) {
    fail(`${where}: weight must be a number from 0 to 100`);
  }
  if (item["@accessibility"] !== undefined) {
    const a11y = item["@accessibility"];
    if (!isRecord(a11y) || Object.keys(a11y).some((key) => key !== "label" && key !== "description")) fail(`${where}: @accessibility takes label and description`);
    for (const key of ["label", "description"]) if ((a11y as Record<string, unknown>)[key] !== undefined) literal((a11y as Record<string, unknown>)[key], `${where}.@accessibility.${key}`, MAX_LABEL);
  }
  const children: string[] = [];
  switch (kind) {
    case "Text":
      literal(item.text, `${where}.text`, MAX_TEXT);
      break;
    case "Image":
      if (typeof item.url !== "string" || !IMAGE_URL.test(item.url)) fail(`${where}.url must be a NutShell file link like /api/files/fil_…/view`);
      if (item.description !== undefined) literal(item.description, `${where}.description`, MAX_LABEL);
      break;
    case "Icon":
      if (typeof item.name !== "string" || !ICON.test(item.name)) fail(`${where}.name must be an icon name like check or info`);
      break;
    case "Row":
    case "Column":
    case "List": {
      if (!Array.isArray(item.children)) fail(`${where}.children must be a list of component ids (templates aren't allowed)`);
      const list = item.children as unknown[];
      if (list.length > MAX_CHILDREN) fail(`${where} has more than ${MAX_CHILDREN} children`);
      list.forEach((child, i) => children.push(ref(child, `${where}.children[${i}]`)));
      break;
    }
    case "Card":
      children.push(ref(item.child, `${where}.child`));
      break;
    case "Tabs": {
      if (!Array.isArray(item.tabs) || item.tabs.length === 0 || item.tabs.length > MAX_TABS) fail(`${where}.tabs must list 1 to ${MAX_TABS} tabs`);
      (item.tabs as unknown[]).forEach((tab, i) => {
        if (!isRecord(tab) || Object.keys(tab).some((key) => key !== "title" && key !== "child")) fail(`${where}.tabs[${i}] takes title and child`);
        literal((tab as Record<string, unknown>).title, `${where}.tabs[${i}].title`, MAX_LABEL);
        children.push(ref((tab as Record<string, unknown>).child, `${where}.tabs[${i}].child`));
      });
      break;
    }
    case "Modal":
      children.push(ref(item.trigger, `${where}.trigger`), ref(item.content, `${where}.content`));
      break;
    case "Button":
      children.push(ref(item.child, `${where}.child`));
      checkAction(item.action, where);
      break;
  }
  return { component: item as A2uiComponent, children };
}

const HEADING = /^h([1-5])$/;

// v0.9 ids could have - and start with a digit; v1.0 ids can't. Each becomes a v1.0 id, kept unique.
function upgradeIds(components: unknown[]): Map<string, string> {
  const ids = components.map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null));
  const taken = new Set(ids.filter((id): id is string => id !== null && ID.test(id)));
  const map = new Map<string, string>();
  for (const id of ids) {
    if (id === null || ID.test(id) || map.has(id) || id.length > 64) continue;
    const base = id.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(?=[0-9])/, "_").slice(0, 60);
    let next = base;
    for (let n = 2; taken.has(next); n += 1) next = `${base}_${n}`;
    taken.add(next);
    map.set(id, next);
  }
  return map;
}

function upgradeComponent(raw: unknown, ids: Map<string, string>): unknown {
  if (!isRecord(raw)) return raw;
  const item: Record<string, unknown> = { ...raw };
  const id = (value: unknown) => (typeof value === "string" ? (ids.get(value) ?? value) : value);
  item.id = id(item.id);
  for (const key of ["child", "trigger", "content"]) if (key in item) item[key] = id(item[key]);
  if (Array.isArray(item.children)) item.children = item.children.map(id);
  if (Array.isArray(item.tabs)) item.tabs = item.tabs.map((tab) => (isRecord(tab) && "child" in tab ? { ...tab, child: id(tab.child) } : tab));
  if ("accessibility" in item) {
    item["@accessibility"] = item.accessibility;
    delete item.accessibility;
  }
  // v1.0 Text has no heading variants; a heading is markdown instead.
  const heading = item.component === "Text" && typeof item.variant === "string" ? HEADING.exec(item.variant) : null;
  if (heading && typeof item.text === "string") {
    item.text = `${"#".repeat(Number(heading[1]))} ${item.text}`;
    delete item.variant;
  }
  const action = item.action;
  if (isRecord(action) && isRecord(action.functionCall) && "call" in action.functionCall) {
    const { call, args } = action.functionCall;
    item.action = { functionCall: { "@call": call, args } };
  }
  return item;
}

/**
 * A v0.9 block rewritten as v1.0 (ids made identifiers, fields renamed, heading variants as markdown). Anything else is
 * returned as it came, for checkBlock to judge. Safe on blocks stored before v1.0.
 */
export function upgradeBlock(raw: unknown): unknown {
  if (!isRecord(raw) || raw.version !== LEGACY_VERSION || !Array.isArray(raw.components)) return raw;
  const ids = upgradeIds(raw.components);
  return { ...raw, version: A2UI_VERSION, components: raw.components.map((item) => upgradeComponent(item, ids)) };
}

/**
 * Checks a block and returns it as stored (always v1.0). Throws BlockError with a message a person
 * or agent can act on. Rules: version 1.0 (or v0.9, upgraded first); at most 100 components and 32 KB; one tree under "root" where every
 * reference points at a component and every component is used exactly once.
 */
export function checkBlock(input: unknown): A2uiBlock {
  const raw = upgradeBlock(input);
  if (!isRecord(raw)) fail("ui must be an object: { version, components }");
  const block = raw as Record<string, unknown>;
  if (Object.keys(block).some((key) => key !== "version" && key !== "components")) fail("ui takes only version and components");
  if (block.version !== A2UI_VERSION) fail(`ui.version must be "${A2UI_VERSION}"`);
  if (!Array.isArray(block.components) || block.components.length === 0) fail("ui.components must list at least one component");
  const list = block.components as unknown[];
  if (list.length > MAX_COMPONENTS) fail(`ui has more than ${MAX_COMPONENTS} components`);
  if (new TextEncoder().encode(JSON.stringify(block)).length > MAX_BLOCK_BYTES) fail(`ui is larger than ${MAX_BLOCK_BYTES / 1000} KB`);

  const byId = new Map<string, string[]>();
  const components: A2uiComponent[] = [];
  list.forEach((item, index) => {
    const { component, children } = checkComponent(item, index);
    if (byId.has(component.id)) fail(`Two components share the id ${component.id}`);
    byId.set(component.id, children);
    components.push(component);
  });
  if (!byId.has("root")) fail('One component must have the id "root"');

  // One tree: each id is used once, all reachable from root, no loops.
  const seen = new Set<string>(["root"]);
  const walk = (id: string, depth: number): void => {
    if (depth > 30) fail("ui is nested too deeply");
    for (const child of byId.get(id)!) {
      if (!byId.has(child)) fail(`${id} points at ${child}, which isn't in the block`);
      if (seen.has(child)) fail(`${child} is used more than once (or loops back)`);
      seen.add(child);
      walk(child, depth + 1);
    }
  };
  walk("root", 0);
  const unused = [...byId.keys()].filter((id) => !seen.has(id));
  if (unused.length) fail(`Not reachable from root: ${unused.slice(0, 5).join(", ")}`);
  return { version: A2UI_VERSION, components };
}
