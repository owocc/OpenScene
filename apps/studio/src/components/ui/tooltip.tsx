import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;

function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipPortal(props: ComponentProps<typeof TooltipPrimitive.Portal>) {
  return <TooltipPrimitive.Portal data-slot="tooltip-portal" {...props} />;
}

function TooltipPositioner({
  className,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Positioner>) {
  return (
    <TooltipPrimitive.Positioner
      data-slot="tooltip-positioner"
      sideOffset={8}
      className={cn("z-[70]", className)}
      {...props}
    />
  );
}

function TooltipContent({ className, ...props }: ComponentProps<typeof TooltipPrimitive.Popup>) {
  return (
    <TooltipPrimitive.Popup
      data-slot="tooltip-content"
      className={cn(
        "rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background shadow-lg outline-none",
        className,
      )}
      {...props}
    />
  );
}

function IconTooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: ReactElement;
  side?: ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
}) {
  return (
    <Tooltip>
      <TooltipPrimitive.Trigger render={children} aria-label={label} />
      <TooltipPortal>
        <TooltipPositioner side={side}>
          <TooltipContent>{label}</TooltipContent>
        </TooltipPositioner>
      </TooltipPortal>
    </Tooltip>
  );
}

export {
  IconTooltip,
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipPositioner,
  TooltipProvider,
  TooltipTrigger,
};
