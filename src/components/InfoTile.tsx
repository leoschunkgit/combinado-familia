import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InfoTile({
  label,
  value,
  icon,
  className,
  valueClassName,
  compact = false,
  inline = false,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
  valueClassName?: string;
  compact?: boolean;
  inline?: boolean;
}) {
  const labelClassName = cn(
    "flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground",
    compact ? "text-[10px]" : "text-xs",
  );
  const valueClasses = cn(
    "min-w-0 font-medium text-foreground",
    compact ? "text-xs leading-snug" : "",
    valueClassName,
  );

  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-muted/20",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        className,
      )}
    >
      {inline ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <div className={labelClassName}>
            {icon}
            <span>{label}</span>
          </div>
          <div className={valueClasses}>{value}</div>
        </div>
      ) : (
        <>
          <div className={cn("mb-0.5", labelClassName)}>
            {icon}
            <span>{label}</span>
          </div>
          <div className={valueClasses}>{value}</div>
        </>
      )}
    </div>
  );
}
