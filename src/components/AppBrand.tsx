import { Home } from "lucide-react";

export function AppBrand({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 md:gap-3 ${className}`.trim()}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground md:h-10 md:w-10">
        <Home className="h-[18px] w-[18px] md:h-5.5 md:w-5.5" />
      </span>
      <span className="flex flex-col items-start leading-none">
        <span className="font-display text-xl font-bold md:text-[22px]">Combinado</span>
        <span className="-mt-1 text-xs font-semibold tracking-wide text-muted-foreground">família</span>
      </span>
    </span>
  );
}
