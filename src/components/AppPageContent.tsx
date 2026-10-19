import type { ReactNode } from "react";

export const appPageInnerClass = "mx-auto w-full max-w-5xl";
export const appPageHorizontalPaddingClass = "px-4 md:px-10";

export function AppPageContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`min-w-0 flex-1 ${appPageHorizontalPaddingClass} py-4 md:py-10 ${className}`.trim()}>
      <div className={appPageInnerClass}>{children}</div>
    </main>
  );
}
