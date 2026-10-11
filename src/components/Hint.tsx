import type { ComponentProps, ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HintProps = {
  content?: ReactNode;
  children: ReactElement;
  side?: ComponentProps<typeof TooltipContent>["side"];
  align?: ComponentProps<typeof TooltipContent>["align"];
  sideOffset?: number;
  className?: string;
};

export function Hint({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset,
  className,
}: HintProps) {
  if (content === null || content === undefined || content === "") {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={className}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
