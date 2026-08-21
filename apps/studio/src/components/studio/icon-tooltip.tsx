import type { ReactElement, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type TooltipSide = "bottom" | "inline-end" | "inline-start" | "left" | "right" | "top";

export function IconTooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: ReactElement;
  side?: TooltipSide;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} aria-label={label} />
      <TooltipContent side={side} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function StudioTooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}
