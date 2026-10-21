import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InfoTile({
  label,
  value,
  icon,
  className,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-muted/20 px-3 py-2", className)}>
      <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("min-w-0 font-medium text-foreground", valueClassName)}>
        {value}
      </div>
    </div>
  );
}
