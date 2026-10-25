import { CATEGORY_COLORS } from "@/lib/categories"
import type { ProjectTemplate } from "@/lib/templates"
import { cn } from "@/lib/utils"

// One roomy frame. Column names stay whole; the dialog is wide enough that
// a five-column board does not have to clip them.
const LAYOUT_LABEL = { board: "Board", table: "Table", roadmap: "Roadmap" } as const

export function TemplatePreview({ template }: { template: ProjectTemplate }) {
  return (
    <div
      data-template={template.id}
      data-layout={template.layout}
      data-slot="template-preview"
      aria-hidden="true"
      className="flex w-full flex-col gap-4 rounded-xl border bg-muted/30 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{LAYOUT_LABEL[template.layout]}</span>
        <span data-slot="template-preview-footer" className="text-sm text-muted-foreground">
          {template.footer}
        </span>
      </div>
      {template.layout === "roadmap" ? (
        <RoadmapFrame template={template} />
      ) : template.layout === "table" ? (
        <TableFrame template={template} />
      ) : (
        <BoardFrame template={template} />
      )}
    </div>
  )
}

function BoardFrame({ template }: { template: ProjectTemplate }) {
  return (
    <div
      className="grid items-stretch gap-3"
      style={{ gridTemplateColumns: `repeat(${template.columns.length}, minmax(7.5rem, 1fr))` }}
    >
      {template.columns.map((column, index) => (
        <div
          key={`${column.name}-${index}`}
          data-slot="template-column-skeleton"
          className="flex min-w-0 flex-col gap-3 rounded-lg bg-background p-3"
        >
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-snug font-medium text-foreground">
            <span
              className={cn("size-2.5 shrink-0 rounded-full", CATEGORY_COLORS[column.color].dot)}
            />
            <span>{column.name}</span>
            {column.name === template.wipColumn && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs leading-none font-normal text-muted-foreground">
                WIP
              </span>
            )}
          </span>
          {Array.from({ length: index === 0 ? 2 : 1 }, (_, card) => (
            <span
              key={card}
              data-slot="template-card-skeleton"
              className="flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-sm"
            >
              <span className="h-2.5 w-4/5 rounded-full bg-muted" />
              <span className="h-2.5 w-3/5 rounded-full bg-muted/80" />
              <span className="h-2 w-2/5 rounded-full bg-muted/60" />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function TableFrame({ template }: { template: ProjectTemplate }) {
  const headers = ["Title", "Status", ...template.fields]
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div
        className="grid border-b bg-muted/40"
        style={{ gridTemplateColumns: `minmax(8rem, 1.4fr) repeat(${headers.length - 1}, minmax(6.5rem, 1fr))` }}
      >
        {headers.map((header) => (
          <span key={header} className="px-3 py-2 text-sm font-medium">
            {header}
          </span>
        ))}
      </div>
      {template.columns.map((column, index) => (
        <div
          key={`${column.name}-${index}`}
          className="grid border-b last:border-b-0"
          style={{ gridTemplateColumns: `minmax(8rem, 1.4fr) repeat(${headers.length - 1}, minmax(6.5rem, 1fr))` }}
        >
          <span className="flex items-center px-3 py-3">
            <span className="h-2.5 w-4/5 rounded-full bg-muted" />
          </span>
          <span className="flex items-center px-3 py-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
                CATEGORY_COLORS[column.color].card
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-full", CATEGORY_COLORS[column.color].dot)} />
              {column.name}
            </span>
          </span>
          {template.fields.map((field) => (
            <span key={field} className="flex items-center px-3 py-3">
              <span className="h-2.5 w-2/3 rounded-full bg-muted/70" />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function RoadmapFrame({ template }: { template: ProjectTemplate }) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${template.columns.length}, minmax(7.5rem, 1fr))` }}
      >
        {template.columns.map((column, index) => (
          <span
            key={`${column.name}-${index}`}
            className="flex items-center gap-1.5 text-sm leading-snug font-medium"
          >
            <span
              className={cn("size-2.5 shrink-0 rounded-full", CATEGORY_COLORS[column.color].dot)}
            />
            <span>{column.name}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-col justify-center gap-4 py-2">
        {template.columns.map((column, index) => (
          <div key={`${column.name}-bar-${index}`} className="flex">
            <span
              className={cn("h-4 rounded-full", CATEGORY_COLORS[column.color].card)}
              style={{
                marginLeft: `${(index / template.columns.length) * 68}%`,
                width: `${26 + (index % 3) * 8}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
