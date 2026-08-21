import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function ButtonGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="button-group"
      role="group"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export { ButtonGroup };
