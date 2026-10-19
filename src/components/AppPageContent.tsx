import type { ReactNode } from "react";

export function AppPageContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`min-w-0 flex-1 p-4 md:p-10 ${className}`.trim()}>
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </main>
  );
}
