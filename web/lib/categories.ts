import {
  BOARD_COLUMNS,
  STATUS_LABELS,
  type CategoryColor,
  type TicketStatus,
} from "@/shared/names"
import type { Category } from "@/lib/types"

// Colors a category (board column) can use. No blue or purple, per the design
// rules. Class names are written out in full so Tailwind can find them.
export const CATEGORY_COLORS = {
  gray: { label: "Gray", dot: "bg-neutral-400", column: "bg-muted/60", card: "bg-neutral-200 dark:bg-neutral-800" },
  red: { label: "Red", dot: "bg-red-500", column: "bg-red-50 dark:bg-red-950/30", card: "bg-red-100 dark:bg-red-900/40" },
  orange: { label: "Orange", dot: "bg-orange-500", column: "bg-orange-50 dark:bg-orange-950/30", card: "bg-orange-100 dark:bg-orange-900/40" },
  amber: { label: "Amber", dot: "bg-amber-400", column: "bg-amber-50 dark:bg-amber-950/30", card: "bg-amber-100 dark:bg-amber-900/40" },
  green: { label: "Green", dot: "bg-green-500", column: "bg-green-50 dark:bg-green-950/30", card: "bg-green-100 dark:bg-green-900/40" },
  teal: { label: "Teal", dot: "bg-teal-500", column: "bg-teal-50 dark:bg-teal-950/30", card: "bg-teal-100 dark:bg-teal-900/40" },
  pink: { label: "Pink", dot: "bg-pink-500", column: "bg-pink-50 dark:bg-pink-950/30", card: "bg-pink-100 dark:bg-pink-900/40" },
} as const satisfies Record<CategoryColor, { label: string; dot: string; column: string; card: string }>
export type { CategoryColor }
export const CATEGORY_COLOR_NAMES = Object.keys(CATEGORY_COLORS) as CategoryColor[]

const DEFAULT_COLORS: Record<TicketStatus, CategoryColor> = {
  backlog: "gray",
  in_progress: "amber",
  in_review: "orange",
  done: "green",
}

// The board starts with the four shared status words as its categories.
export const DEFAULT_CATEGORIES: Category[] = BOARD_COLUMNS.map((slug, order) => ({
  slug,
  name: STATUS_LABELS[slug],
  color: DEFAULT_COLORS[slug],
  order,
}))

// "Needs QA!" -> "needs_qa". Adds _2, _3 ... if the slug is already taken.
export function makeSlug(name: string, taken: string[]) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "category"
  let slug = base
  for (let n = 2; taken.includes(slug); n++) slug = `${base}_${n}`
  return slug
}

// Display name for a category slug, falling back to the shared labels.
export function categoryName(slug: string, categories: Category[] = DEFAULT_CATEGORIES) {
  return (
    categories.find((c) => c.slug === slug)?.name ??
    STATUS_LABELS[slug as TicketStatus] ??
    slug
  )
}
