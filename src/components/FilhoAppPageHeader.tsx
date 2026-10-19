import type { ReactNode } from "react";

export function FilhoAppPageHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground">
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <h1 className="text-lg font-bold leading-tight">{title}</h1>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
