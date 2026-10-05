import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapseChevron({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground shadow-sm transition-all duration-200 group-hover:bg-muted group-hover:text-foreground",
        className,
      )}
    >
      <ChevronDown
        className={cn(
          "h-4 w-4 transition-transform duration-200",
          open ? "rotate-0" : "-rotate-90",
        )}
      />
    </span>
  );
}
