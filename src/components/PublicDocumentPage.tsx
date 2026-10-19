import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppBrand } from "@/components/AppBrand";
import { appPageHorizontalPaddingClass } from "@/components/AppPageContent";

export function PublicDocumentPage({ children }: { children: ReactNode }) {
  return (
    <main className={`native-safe-area min-h-screen bg-muted/30 ${appPageHorizontalPaddingClass} py-6 md:py-10`}>
      <div className="mx-auto w-full max-w-3xl rounded-2xl border bg-background p-5 shadow-sm sm:p-6 md:p-8">
        <Link
          to="/"
          className="mb-6 inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Ir para o início"
        >
          <AppBrand />
        </Link>
        {children}
      </div>
    </main>
  );
}
