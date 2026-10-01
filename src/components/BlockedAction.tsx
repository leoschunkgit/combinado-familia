import { useState, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function BlockedAction({ reason, children }: { reason: string | undefined; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!reason) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed" tabIndex={0} aria-label={reason} onClick={() => setOpen((current) => !current)} onBlur={() => setOpen(false)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-center">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}