import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InfoTile({
  label,
  value,
  icon,
  className,
  valueClassName,
  compact = false,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
  valueClassName?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-muted/20",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        className,
      )}
    >
      <div
        className={cn(
          "mb-0.5 flex items-center gap-1.5 font-medium text-muted-foreground",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "min-w-0 font-medium text-foreground",
          compact ? "text-xs leading-snug" : "",
          valueClassName,
        )}
      >
        {value}
      </div>
    </div>
  );
}
