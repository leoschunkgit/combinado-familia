import type { ReactNode } from "react";
import { uiSpacing } from "@/lib/ui-spacing";

export function PageHeader({ title, description, icon, action }: { title: string; description: string; icon: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${uiSpacing.pageHeader} grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-x-4`}>
      <div className="row-span-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground md:h-12 md:w-12 md:rounded-2xl">
        {icon}
      </div>
      <h1 className="min-w-0 text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
      {action && <div className="shrink-0 pt-0.5 md:pt-1">{action}</div>}
      <p className="col-start-2 col-end-4 min-w-0 text-sm leading-relaxed text-muted-foreground md:text-base">{description}</p>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}
