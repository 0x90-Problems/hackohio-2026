/**
 * Table fields: the extra columns a project's table shows next to Title and Status (Estimate,
 * Target date, Owner...). Each has a type, which decides how its values are checked and shown.
 *
 * A project keeps `field_defs` ({ id, name, type, options }) and, for older readers, `fields`
 * (the names in order). A ticket keeps its values in `field_values`, by field id, so renaming a
 * field keeps its values. Every value is a string; an empty one clears the cell.
 *
 * Dependency-free so the web app can keep an identical copy (web/lib/table-fields.ts in the web
 * app; src/table-fields.ts in the board backend).
 */

export const FIELD_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  COUNTDOWN: "countdown",
  PERSON: "person",
  SELECT: "select",
  CHECKBOX: "checkbox",
  LINK: "link",
} as const;
export type FieldType = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  countdown: "Countdown",
  person: "Person",
  select: "Single select",
  checkbox: "Checkbox",
  link: "Link",
};

export const FIELD_TYPE_HINTS: Record<FieldType, string> = {
  text: "Any short text.",
  number: "A number, such as an estimate.",
  date: "A day (YYYY-MM-DD).",
  countdown: "A day to count down to; shows days left or overdue.",
  person: "Someone in your organization.",
  select: "One of a list of options you set.",
  checkbox: "Done or not done.",
  link: "An https link.",
};

export type FieldDef = { id: string; name: string; type: FieldType; options?: string[] };

export const MAX_FIELDS = 20;
export const MAX_FIELD_NAME = 40;
export const MAX_OPTIONS = 30;
export const MAX_OPTION = 40;
export const MAX_TEXT_VALUE = 500;
const ID = /^f_[a-z0-9_]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set<string>(Object.values(FIELD_TYPES));
// Title and Status are the table's own columns.
const RESERVED = new Set(["title", "status"]);

export class FieldError extends Error {}

const fail = (message: string): never => {
  throw new FieldError(message);
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function idFor(name: string, taken: Set<string>): string {
  const base = `f_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "field"}`;
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}_${n}`;
  taken.add(id);
  return id;
}

// Template fields are names only; a few common ones get a better type than text.
function guessType(name: string): FieldType {
  if (/date|deadline|due/i.test(name)) return FIELD_TYPES.DATE;
  if (/estimate|points|hours|size/i.test(name)) return FIELD_TYPES.NUMBER;
  return FIELD_TYPES.TEXT;
}

/** A project's fields: its field_defs, or, for a project saved before field types, one per name. */
export function fieldDefsOf(project: { field_defs?: unknown; fields?: unknown }): FieldDef[] {
  if (Array.isArray(project.field_defs)) {
    return project.field_defs.filter(
      (item): item is FieldDef => isRecord(item) && typeof item.id === "string" && typeof item.name === "string" && TYPES.has(item.type as string),
    ).map((item) => ({ id: item.id, name: item.name, type: item.type, ...(item.type === FIELD_TYPES.SELECT ? { options: [...(item.options ?? [])] } : {}) }));
  }
  const taken = new Set<string>();
  const names = Array.isArray(project.fields) ? project.fields.filter((name): name is string => typeof name === "string" && name.trim() !== "") : [];
  return names.map((name) => ({ id: idFor(name, taken), name, type: guessType(name) }));
}

/**
 * Checks a new list of fields for a project, in table order. A field that keeps its id keeps
 * its values; one without an id is new. Returns the list as stored.
 */
export function parseFieldDefs(raw: unknown, current: FieldDef[]): FieldDef[] {
  if (!Array.isArray(raw) || raw.length > MAX_FIELDS) fail(`fields is a list of at most ${MAX_FIELDS}`);
  const known = new Set(current.map((field) => field.id));
  const taken = new Set<string>(known);
  const names = new Set<string>();
  const ids = new Set<string>();
  return (raw as unknown[]).map((item, index) => {
    if (!isRecord(item)) fail(`fields[${index}] must be { name, type }`);
    const field = item as Record<string, unknown>;
    if (Object.keys(field).some((key) => !["id", "name", "type", "options"].includes(key))) fail(`fields[${index}] takes id, name, type and options`);
    const name = typeof field.name === "string" ? field.name.trim() : "";
    if (!name || name.length > MAX_FIELD_NAME) fail(`A field's name is 1 to ${MAX_FIELD_NAME} characters`);
    if (RESERVED.has(name.toLowerCase())) fail(`${name} is already a column`);
    if (names.has(name.toLowerCase())) fail(`Two fields are called ${name}`);
    names.add(name.toLowerCase());
    if (typeof field.type !== "string" || !TYPES.has(field.type)) fail(`${name}: type must be one of ${[...TYPES].join(", ")}`);
    const type = field.type as FieldType;
    let id: string;
    if (field.id !== undefined) {
      if (typeof field.id !== "string" || !ID.test(field.id) || !known.has(field.id)) fail(`${name}: unknown field id ${String(field.id)}`);
      id = field.id as string;
    } else {
      id = idFor(name, taken);
    }
    if (ids.has(id)) fail(`Two fields share the id ${id}`);
    ids.add(id);
    if (type !== FIELD_TYPES.SELECT) {
      if (field.options !== undefined) fail(`${name}: only a single select field has options`);
      return { id, name, type };
    }
    const options = field.options;
    if (!Array.isArray(options) || options.length === 0 || options.length > MAX_OPTIONS) fail(`${name}: a single select has 1 to ${MAX_OPTIONS} options`);
    const seen = new Set<string>();
    const clean = (options as unknown[]).map((option) => {
      const text = typeof option === "string" ? option.trim() : "";
      if (!text || text.length > MAX_OPTION) fail(`${name}: each option is 1 to ${MAX_OPTION} characters`);
      if (seen.has(text.toLowerCase())) fail(`${name}: two options are called ${text}`);
      seen.add(text.toLowerCase());
      return text;
    });
    return { id, name, type, options: clean };
  });
}

/** A real day, as YYYY-MM-DD. */
function isDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * One value for a field, as stored ("" clears it). `isPerson` says whether a user id is someone
 * the writer may name. Throws FieldError with a message a person or agent can act on.
 */
export function checkFieldValue(field: FieldDef, raw: unknown, isPerson: (id: string) => boolean): string {
  if (raw === null || raw === undefined) return "";
  if (field.type === FIELD_TYPES.CHECKBOX && typeof raw === "boolean") return raw ? "true" : "";
  if (field.type === FIELD_TYPES.NUMBER && typeof raw === "number") raw = String(raw);
  if (typeof raw !== "string") fail(`${field.name}: the value must be text`);
  const value = (raw as string).trim();
  if (value === "") return "";
  switch (field.type) {
    case FIELD_TYPES.TEXT:
      if (value.length > MAX_TEXT_VALUE) fail(`${field.name}: at most ${MAX_TEXT_VALUE} characters`);
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`${field.name}: no control characters`);
      return value;
    case FIELD_TYPES.NUMBER: {
      const number = Number(value);
      if (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(number) || value.length > 20) fail(`${field.name}: must be a number, such as 3 or 2.5`);
      return value;
    }
    case FIELD_TYPES.DATE:
    case FIELD_TYPES.COUNTDOWN:
      if (!isDay(value)) fail(`${field.name}: must be a day as YYYY-MM-DD`);
      return value;
    case FIELD_TYPES.PERSON:
      if (!isPerson(value)) fail(`${field.name}: ${value} isn't someone in your organization`);
      return value;
    case FIELD_TYPES.SELECT: {
      const match = (field.options ?? []).find((option) => option.toLowerCase() === value.toLowerCase());
      if (!match) fail(`${field.name}: must be one of ${(field.options ?? []).join(", ")}`);
      return match as string;
    }
    case FIELD_TYPES.CHECKBOX:
      if (value !== "true" && value !== "false") fail(`${field.name}: must be true or false`);
      return value === "true" ? "true" : "";
    case FIELD_TYPES.LINK: {
      let ok = false;
      try {
        const url = new URL(value);
        ok = url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password && value.length <= 2048;
      } catch {
        ok = false;
      }
      if (!ok) fail(`${field.name}: must be an https link`);
      return value;
    }
  }
  return fail(`${field.name}: unknown type`);
}

/** Finds a field by id or (case-insensitive) name. */
export function findField(fields: FieldDef[], ref: string): FieldDef | undefined {
  return fields.find((field) => field.id === ref) ?? fields.find((field) => field.name.toLowerCase() === ref.trim().toLowerCase());
}

/** Whole days from `today` to `day` (both YYYY-MM-DD): positive ahead, negative overdue. */
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
