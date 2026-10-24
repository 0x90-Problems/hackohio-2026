import type { ProjectTemplate } from "@/lib/templates"
import { cn } from "@/lib/utils"

export function TemplatePreview({ template }: { template: ProjectTemplate }) {
  const isRoadmap = template.id === "roadmap"
  return (
    <div
      data-template={template.id}
      aria-hidden="true"
      className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 overflow-hidden rounded-lg border bg-muted/20 p-2"
    >
      <div
        className="grid min-w-0 gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${template.columns.length}, minmax(0, 1fr))`,
        }}
      >
        {template.columns.map((column, index) => (
          <div
            key={`${column.name}-${index}`}
            data-slot="template-column-skeleton"
            className="flex min-w-0 flex-col gap-1.5 rounded-md border bg-background p-1.5"
          >
            <span className="h-1.5 w-3/4 rounded-full bg-muted" />
            {Array.from(
              {
                length:
                  template.id === "team-retrospective"
                    ? 1
                    : template.id === "bug-tracker" && index === 0
                      ? 2
                      : (template.id === "team-planning" ||
                            template.id === "iterative-development") &&
                          index === 1
                        ? 2
                        : index === 0
                          ? 2
                          : 1,
              },
              (_, cardIndex) => (
                <span
                  key={cardIndex}
                  data-slot="template-card-skeleton"
                  className="flex flex-col gap-1 rounded border border-dashed border-border p-1.5"
                >
                  <span className="h-1.5 w-full rounded-full bg-muted" />
                  <span
                    className={cn(
                      "h-1 w-2/3 rounded-full bg-muted",
                      template.id === "team-retrospective" && "mx-auto w-1/2"
                    )}
                  />
                  {cardIndex === 0 && (
                    <span className="mt-0.5 h-1 w-1/3 rounded-full bg-muted" />
                  )}
                </span>
              )
            )}
          </div>
        ))}
        {isRoadmap && (
          <div
            data-slot="template-roadmap-skeleton"
            className="col-span-full flex flex-col gap-2 rounded-md border bg-background p-2"
          >
            <span className="h-1.5 w-1/4 rounded-full bg-muted" />
            <div className="grid grid-cols-4 text-[8px] text-muted-foreground">
              <span>Now</span>
              <span>Next</span>
              <span>Later</span>
              <span>Future</span>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-dashed border-border pt-1.5">
              <span className="h-1.5 w-2/3 rounded-full bg-muted" />
              <span className="h-1.5 w-1/2 self-end rounded-full bg-muted" />
            </div>
          </div>
        )}
      </div>

      <aside
        data-slot="template-timeline-skeleton"
        className="flex min-w-0 flex-col gap-2 border-l pl-2"
      >
        <span className="h-1.5 w-4/5 rounded-full bg-muted" />
        <div className="flex min-h-12 flex-col justify-center gap-1.5 border-l border-dashed border-border pl-2">
          <span className="text-[9px] leading-tight text-muted-foreground">
            {isRoadmap ? "No milestones yet" : "No dates yet"}
          </span>
          <span className="h-1 w-3/4 rounded-full bg-muted" />
        </div>
      </aside>
    </div>
  )
}
