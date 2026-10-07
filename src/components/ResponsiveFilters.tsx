import { useState, type ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function ResponsiveFilters({
  children,
  onApply,
  desktopClassName,
}: {
  children: ReactNode;
  onApply: () => void;
  desktopClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  function aplicar() {
    onApply();
    setOpen(false);
  }

  return (
    <>
      <div className="mb-4 flex justify-end md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label="Abrir filtros"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      <Card className="mb-6 hidden md:block">
        <CardContent
          className={cn(
            "grid gap-4 pt-6 md:items-end",
            desktopClassName,
          )}
        >
          {children}
          <Button type="button" onClick={onApply}>
            <Search className="h-4 w-4" />
            Pesquisar
          </Button>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[88vw] max-w-sm overflow-y-auto p-5"
        >
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              Filtros
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">{children}</div>

          <SheetFooter className="mt-6">
            <Button type="button" className="w-full sm:w-auto" onClick={aplicar}>
              <Search className="h-4 w-4" />
              Pesquisar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
