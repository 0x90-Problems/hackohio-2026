@AGENTS.md

# Nutshell design rules

## Setup
- This is the Nutshell Next.js app, using shadcn/ui with preset bbZZwVU (Maia style, Neutral base, Red theme, Inter font).
- Use Radix UI as the base for all shadcn components. Never copy Base UI or React Aria versions.
- Default to light mode. Keep dark mode working, but light is what we demo.
- Shared names (scopes, statuses, actor types, collection names) come from `../shared/names.ts`. Import them as `"@/shared/names"`. Never type those names as strings.
- Field names must match `../docs/schema.md`.

## Color rules
- Red (primary) is only for main actions: "+ New ticket", "+ New team", "Generate token", "Create API key", "Approve".
- Destructive actions like "Revoke" use the `destructive` button variant, never primary.
- No blue or purple anywhere. Replace any blue from the wireframes with primary red or neutral gray.
- Humans: solid circle avatar with initials.
- Agents: neutral gray badge with a dashed border that says "AGENT", followed by the model name and "for [owner name]". Humans and agents must always be easy to tell apart.

## Animation rules
- Use tw-animate-css (already installed) for all simple animations. Keep them short: 150–300ms.
- Use the `motion` npm package (import from "motion/react") for richer effects: ticket cards moving between columns (layoutId), columns and cards entering/leaving (AnimatePresence), staggered fade-ups (project cards, board columns), tag pills, and the live activity list. Keep springs snappy (stiffness ~400, damping ~30).
- Do not add any other animation libraries, and do not install Motion UI / motion registry components; build effects with the `motion` package directly.
- Pages under /projects are wrapped in `MotionConfig reducedMotion="user"` (in `ProjectsProvider`). Wrap any new motion page the same way.
- Every animation must respect `prefers-reduced-motion`.

## Homepage
- Header with a grid (app launcher) icon on the left; a "Welcome" card at the top left; under it a "Pending actions & recent comments" feed; a "Recent changes" column on the right covering the last 24 hours.
- Welcome card fades in once on page load.
- Both feeds: new items slide in from the top and fade in (`animate-in fade-in slide-in-from-top-2`).
- Both feeds are paginated ("1 of 5"). Fade the list when switching pages.
- Show shadcn `Skeleton` placeholders while data loads.

## All pages
- Clickable cards lift slightly with a shadow on hover.
- The ticket detail opens in a centered modal (shadcn `Dialog`) at /projects/[key]/board/ticket/[id]. Closing it returns to the board.
- Search boxes use the "combo search box" design: shadcn Combobox (Popover + Command). Reuse `components/search-combobox.tsx`.
- Board: new items in the Live activity panel slide in from the top. When a ticket's status changes, the card animates to its new column using motion's layout animation.

## Data
- Use mock data for now. Do not connect to the real database yet.
