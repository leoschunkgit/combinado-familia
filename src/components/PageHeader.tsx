import type { ReactNode } from "react";

export function PageHeader({ title, description, icon, action }: { title: string; description: string; icon: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 md:gap-x-4">
      <div className="row-span-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <h1 className="min-w-0 text-3xl font-bold md:text-4xl">{title}</h1>
      {action && <div className="shrink-0 pt-1">{action}</div>}
      <p className="col-start-2 col-end-4 min-w-0 text-muted-foreground">{description}</p>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}
