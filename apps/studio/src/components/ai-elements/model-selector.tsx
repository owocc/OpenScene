import * as React from "react";
import { Astroid, Bot, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function ModelSelector({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children}
    </Popover>
  );
}

export function ModelSelectorTrigger({
  asChild,
  render,
  children,
  ...props
}: React.ComponentProps<typeof PopoverTrigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <PopoverTrigger render={children} {...props} />;
  }
  return (
    <PopoverTrigger render={render} {...props}>
      {children}
    </PopoverTrigger>
  );
}

export function ModelSelectorContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      align="start"
      className={cn("w-64 p-0 shadow-lg border border-border/80", className)}
      {...props}
    >
      <Command className="rounded-3xl">{children}</Command>
    </PopoverContent>
  );
}

export function ModelSelectorInput({
  className,
  placeholder = "Search models or prompts…",
  ...props
}: React.ComponentProps<typeof CommandInput>) {
  return (
    <CommandInput placeholder={placeholder} className={cn("h-8 text-xs", className)} {...props} />
  );
}

export function ModelSelectorList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandList>) {
  return (
    <CommandList className={cn("max-h-56 overflow-y-auto p-1", className)} {...props}>
      {children}
    </CommandList>
  );
}

export function ModelSelectorEmpty({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <CommandEmpty className={cn("py-4 text-center text-xs text-muted-foreground", className)}>
      {children ?? "No options found."}
    </CommandEmpty>
  );
}

export function ModelSelectorGroup({
  heading,
  children,
  className,
}: {
  heading?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <CommandGroup
      heading={heading}
      className={cn("text-xs font-semibold text-muted-foreground", className)}
    >
      {children}
    </CommandGroup>
  );
}

export function ModelSelectorItem({
  value,
  onSelect,
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandItem>) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-foreground aria-selected:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
    </CommandItem>
  );
}

export function ModelSelectorLogo({
  provider,
  className,
}: {
  provider?: string;
  className?: string;
}) {
  const p = (provider || "").toLowerCase();

  return (
    <div
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-sm font-semibold text-[10px]",
        p.includes("openai") && "text-emerald-500",
        p.includes("anthropic") || (p.includes("claude") && "text-amber-500"),
        p.includes("google") || (p.includes("gemini") && "text-blue-500"),
        className,
      )}
    >
      {p.includes("openai") ? (
        <Bot className="size-3.5" />
      ) : p.includes("anthropic") || p.includes("claude") ? (
        <Astroid className="size-3.5" />
      ) : (
        <Cpu className="size-3.5" />
      )}
    </div>
  );
}

export function ModelSelectorLogoGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("ml-auto flex items-center gap-0.5 opacity-60", className)}>{children}</div>
  );
}

export function ModelSelectorName({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("truncate font-medium text-xs text-foreground", className)}>
      {children}
    </span>
  );
}
