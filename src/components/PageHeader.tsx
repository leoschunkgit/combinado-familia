import type { ReactNode } from "react";

export function PageHeader({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return (
    <div className="mb-8 flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}
