import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { CollapseChevron } from "@/components/CollapseChevron";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  description,
  count,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
  action,
  className,
  contentClassName,
  contentDivider = true,
  alignFirstRow = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  count?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  contentDivider?: boolean;
  alignFirstRow?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;

  function alterarAbertura(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      <div className="flex items-start">
        <button
          type="button"
          className={cn(
            "group flex min-w-0 flex-1 gap-3 px-4 py-4 text-left sm:px-5",
            alignFirstRow ? "items-start" : "items-center",
          )}
          onClick={() => alterarAbertura(!open)}
          aria-expanded={open}
        >
          <div className={cn(alignFirstRow && "mt-1.5")}>
            <CollapseChevron open={open} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn("flex min-w-0 items-center gap-2", alignFirstRow && "min-h-8")}>
              <h2 className="min-w-0 break-words text-sm font-semibold sm:text-base">{title}</h2>
              {typeof count === "number" && (
                <Badge variant="secondary" className="h-5 shrink-0 px-1.5 py-0 text-[10px]">
                  {count}
                </Badge>
              )}
            </div>
            {description && <div className="mt-0.5 break-words text-xs text-muted-foreground">{description}</div>}
          </div>
        </button>
        {action && <div className="flex shrink-0 items-center gap-2 py-4 pr-4 sm:pr-5">{action}</div>}
      </div>
      {open && <div className={cn(contentDivider && "border-t", contentClassName)}>{children}</div>}
    </section>
  );
}
