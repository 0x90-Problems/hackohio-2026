// NutShell's spot illustrations. Every color comes from the --illo-* tokens in
// app/globals.css, so the drawings follow the light/dark theme on their own.
import { cn } from "@/lib/utils"

const LINE = "var(--illo-line)"
const FILL = "var(--illo-fill)"
const SOFT = "var(--illo-soft)"
const PAPER = "var(--illo-paper)"
const NUT = "var(--illo-nut)"
const EYE = "var(--illo-nut-eye)"
const ACCENT = "var(--illo-accent)"

type IlloProps = { className?: string }

// A buckeye: brown nut with its tan "eye"
function Nut({ x, y, r = 9 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={NUT} />
      <ellipse
        cx={x + r * 0.32}
        cy={y - r * 0.3}
        rx={r * 0.38}
        ry={r * 0.3}
        fill={EYE}
        transform={`rotate(-30 ${x + r * 0.32} ${y - r * 0.3})`}
      />
    </g>
  )
}

// Error pages: a quiet gray tree with buckeyes in the middle of its crown
export function NutTree({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 320 260"
      className={cn("h-auto w-full", className)}
      aria-hidden
    >
      {/* ground */}
      <ellipse cx="160" cy="236" rx="118" ry="10" fill={SOFT} />
      <path
        d="M52 236 H268"
        stroke={LINE}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* crown */}
      <g fill={FILL}>
        <circle cx="160" cy="92" r="62" />
        <circle cx="104" cy="116" r="42" />
        <circle cx="216" cy="116" r="42" />
        <circle cx="128" cy="62" r="34" />
        <circle cx="194" cy="62" r="34" />
      </g>
      <g fill="none" stroke={LINE} strokeWidth="2" opacity="0.35">
        <path d="M104 74 a42 42 0 0 0 -30 26" />
        <path d="M216 74 a42 42 0 0 1 30 26" />
        <path d="M150 32 a62 62 0 0 1 32 2" />
      </g>
      {/* trunk and branches */}
      <g
        fill="none"
        stroke={LINE}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M160 236 V150" strokeWidth="9" />
        <path d="M160 168 L124 134" />
        <path d="M160 160 L198 126" />
        <path d="M160 150 L160 112" />
        <path d="M124 134 L108 118" strokeWidth="3" />
        <path d="M198 126 L214 112" strokeWidth="3" />
      </g>
      {/* buckeyes in the middle */}
      <Nut x={142} y={98} />
      <Nut x={170} y={86} r={10} />
      <Nut x={160} y={118} />
      <Nut x={186} y={110} r={8} />
      <Nut x={128} y={120} r={7} />
      {/* one that fell */}
      <Nut x={212} y={228} r={7} />
    </svg>
  )
}

// Login and sign-up: a board where a person and an agent move cards together
export function BoardScene({ className }: IlloProps) {
  const card = (x: number, y: number, w = 58, accent = false) => (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height="24"
        rx="5"
        fill={PAPER}
        stroke={LINE}
        strokeOpacity="0.35"
      />
      <rect
        x={x + 7}
        y={y + 7}
        width={w * 0.55}
        height="4"
        rx="2"
        fill={accent ? ACCENT : LINE}
        opacity={accent ? 0.9 : 0.45}
      />
      <rect
        x={x + 7}
        y={y + 14}
        width={w * 0.35}
        height="3"
        rx="1.5"
        fill={LINE}
        opacity="0.3"
      />
    </g>
  )
  return (
    <svg
      viewBox="0 0 360 260"
      className={cn("h-auto w-full", className)}
      aria-hidden
    >
      <ellipse cx="180" cy="238" rx="150" ry="12" fill={SOFT} />
      {/* board */}
      <rect x="40" y="36" width="280" height="180" rx="14" fill={FILL} />
      {[54, 146, 238].map((x, i) => (
        <g key={x}>
          <rect x={x} y="52" width="78" height="150" rx="9" fill={SOFT} />
          <rect
            x={x + 10}
            y="62"
            width={i === 1 ? 34 : 44}
            height="5"
            rx="2.5"
            fill={LINE}
            opacity="0.5"
          />
        </g>
      ))}
      {card(64, 78)}
      {card(64, 108, 58, true)}
      {card(64, 138)}
      {card(156, 78)}
      {card(248, 78, 58, true)}
      {card(248, 108)}
      {/* the card in flight, carried by the agent */}
      <g transform="rotate(-6 196 132)">
        <rect
          x="166"
          y="120"
          width="60"
          height="26"
          rx="5"
          fill={PAPER}
          stroke={ACCENT}
          strokeWidth="1.5"
        />
        <rect x="174" y="128" width="32" height="4" rx="2" fill={ACCENT} />
        <rect
          x="174"
          y="136"
          width="20"
          height="3"
          rx="1.5"
          fill={LINE}
          opacity="0.35"
        />
      </g>
      <path
        d="M130 150 C150 168 160 162 166 146"
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
        strokeDasharray="3 4"
        opacity="0.6"
      />
      {/* agent: dashed outline, like the AGENT tag */}
      <g>
        <rect
          x="200"
          y="158"
          width="40"
          height="34"
          rx="9"
          fill={PAPER}
          stroke={LINE}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <circle cx="213" cy="174" r="3" fill={LINE} />
        <circle cx="227" cy="174" r="3" fill={LINE} />
        <path d="M220 158 V150" stroke={LINE} strokeWidth="1.5" />
        <circle cx="220" cy="148" r="3" fill={ACCENT} />
      </g>
      {/* person: solid circle avatar, like the board's human avatars */}
      <g>
        <circle cx="300" cy="196" r="16" fill={NUT} />
        <circle cx="300" cy="190" r="5.5" fill={EYE} />
        <path d="M291 205 a9 7 0 0 1 18 0" fill={EYE} />
      </g>
      <Nut x={58} y={226} r={7} />
    </svg>
  )
}

// Empty states: an open shell with nothing inside yet
export function EmptyShell({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 120 90"
      className={cn("h-auto w-full", className)}
      aria-hidden
    >
      <ellipse cx="60" cy="80" rx="40" ry="5" fill={SOFT} />
      {/* bottom half */}
      <path d="M22 50 a38 30 0 0 0 76 0 Z" fill={FILL} />
      <path
        d="M22 50 H98"
        stroke={LINE}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* lid, tipped open */}
      <path
        d="M30 42 a32 26 0 0 1 52 -24 Z"
        fill={FILL}
        transform="rotate(-18 30 42)"
      />
      {/* where the nut would be */}
      <circle
        cx="60"
        cy="42"
        r="11"
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.6"
      />
    </svg>
  )
}

// An empty list: the open shell with a short message under it
export function EmptyState({
  title,
  hint,
  className,
}: {
  title: string
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex animate-in flex-col items-center gap-2 py-6 text-center duration-300 fade-in",
        className
      )}
    >
      <EmptyShell className="w-24" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
