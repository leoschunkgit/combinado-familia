import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { CollapseChevron } from "@/components/CollapseChevron";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  description,
  count,
  open,
  onOpenChange,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  count?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      <button
        type="button"
        className="group flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <CollapseChevron open={open} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 break-words text-sm font-semibold sm:text-base">{title}</h2>
            {typeof count === "number" && (
              <Badge variant="secondary" className="h-5 shrink-0 px-1.5 py-0 text-[10px]">
                {count}
              </Badge>
            )}
          </div>
          {description && (
            <div className="mt-0.5 break-words text-xs text-muted-foreground">{description}</div>
          )}
        </div>
      </button>

      {open && (
        <div className={cn("border-t", contentClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}
