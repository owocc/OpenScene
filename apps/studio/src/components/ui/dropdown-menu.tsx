import { Menu } from "@base-ui/react/menu";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const DropdownMenu = Menu.Root;

function DropdownMenuTrigger({ className, ...props }: ComponentProps<typeof Menu.Trigger>) {
  return (
    <Menu.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn(
        "inline-flex items-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuPortal(props: ComponentProps<typeof Menu.Portal>) {
  return <Menu.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuPositioner({ className, ...props }: ComponentProps<typeof Menu.Positioner>) {
  return (
    <Menu.Positioner
      data-slot="dropdown-menu-positioner"
      className={cn("z-50", className)}
      {...props}
    />
  );
}

function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Menu.Popup>) {
  return (
    <Menu.Popup
      data-slot="dropdown-menu-content"
      className={cn(
        "min-w-48 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-slate-950/10 outline-none",
        "data-[side=bottom]:animate-in data-[side=bottom]:fade-in-0 data-[side=bottom]:slide-in-from-top-1",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex min-h-8 cursor-default items-center justify-between gap-6 rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
