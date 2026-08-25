"use client";

import { useId, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Check, ChevronDown, Plus, Search, Variable as VariableIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getStateVariables, type JsonValue, type StateVariableType } from "@/core/document";
import { useStudioStore } from "@/stores/studio-store";
import { formatVariableValuePreview, getVariableTypeIcon } from "./composer-mentions";

export interface VariableItem {
  key: string;
  path: string;
  type: StateVariableType | (string & {});
  value?: JsonValue;
}

export interface VariableComboboxProps {
  value: string | undefined;
  onChange: (path: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  statePaths?: string[];
  variables?: VariableItem[];
  disabled?: boolean;
  allowCustom?: boolean;
  autoFocus?: boolean;
  prefix?: ReactNode;
  addonEnd?: ReactNode;
  size?: "sm" | "default";
}

/**
 * Searchable Combobox for selecting and managing state variables ($state / $bindState).
 */
export function VariableCombobox({
  value,
  onChange,
  placeholder = "Select state variable…",
  className,
  buttonClassName,
  statePaths: customStatePaths,
  variables: customVariables,
  disabled = false,
  allowCustom = true,
  prefix,
  addonEnd,
  size = "sm",
}: VariableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const storeState = useStudioStore((s) => s.document.spec.state);
  const id = useId();

  const allVariables: VariableItem[] = useMemo(() => {
    if (customVariables && customVariables.length > 0) {
      return customVariables;
    }
    const stateVars = getStateVariables(storeState as Record<string, unknown> | undefined);
    if (stateVars.length > 0) {
      return stateVars.map((v) => ({
        key: v.key,
        path: v.path,
        type: v.type,
        value: v.value,
      }));
    }
    if (customStatePaths && customStatePaths.length > 0) {
      return customStatePaths.map((path) => {
        const key = path.replace(/^\/+/, "");
        return {
          key,
          path: path.startsWith("/") ? path : `/${path}`,
          type: "string",
        };
      });
    }
    return [];
  }, [customVariables, storeState, customStatePaths]);

  const normalizedValue = value ? (value.startsWith("/") ? value : `/${value}`) : "";
  const selectedItem = allVariables.find((v) => v.path === normalizedValue || v.key === value);

  const trimmedSearch = search.trim();
  const searchNormalized = trimmedSearch.startsWith("/") ? trimmedSearch : `/${trimmedSearch}`;
  const isSearchExactMatch = allVariables.some(
    (v) =>
      v.path.toLowerCase() === searchNormalized.toLowerCase() ||
      v.key.toLowerCase() === trimmedSearch.toLowerCase(),
  );

  const handleSelect = (chosenPath: string) => {
    const formatted = chosenPath.startsWith("/") ? chosenPath : `/${chosenPath}`;
    onChange(formatted);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const {
    Icon: SelectedIcon,
    color: selectedColor,
    bg: selectedBg,
  } = getVariableTypeIcon(selectedItem?.type);

  return (
    <div className={cn("relative flex items-center gap-1 min-w-0 flex-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-slot="variable-combobox-trigger"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-background/80 px-2.5 text-xs text-foreground shadow-xs outline-none transition-colors select-none",
            "hover:bg-accent/40 focus-visible:ring-1 focus-visible:ring-ring",
            size === "sm" ? "h-8" : "h-9",
            disabled && "cursor-not-allowed opacity-50",
            buttonClassName,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {prefix ?? (
              <span
                className={cn(
                  "flex size-4.5 shrink-0 items-center justify-center rounded text-[10px]",
                  selectedItem ? selectedBg : "bg-primary/10 text-primary",
                )}
              >
                {selectedItem ? (
                  <SelectedIcon className={cn("size-3", selectedColor)} />
                ) : (
                  <VariableIcon className="size-3 text-primary" />
                )}
              </span>
            )}

            {normalizedValue ? (
              <span className="truncate font-mono text-xs font-medium">{normalizedValue}</span>
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}

            {selectedItem && (
              <Badge
                variant="outline"
                className="h-3.5 px-1 text-[9px] font-mono shrink-0 ms-auto me-1 opacity-80"
              >
                {selectedItem.type}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0 text-muted-foreground">
            {normalizedValue && !disabled && (
              <span
                role="button"
                tabIndex={0}
                title="Clear"
                className="rounded p-0.5 hover:bg-muted hover:text-foreground cursor-pointer"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleClear(e as unknown as React.MouseEvent);
                }}
              >
                <X className="size-3" />
              </span>
            )}
            <ChevronDown className="size-3.5 opacity-60" />
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[280px] p-0 rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl"
        >
          <Command loop>
            <div className="flex items-center border-b border-border/50 px-2">
              <Search className="size-3.5 shrink-0 opacity-50 mr-2" />
              <CommandInput
                placeholder="Search variable name, path, value…"
                value={search}
                onValueChange={setSearch}
                className="h-8 text-xs font-mono"
              />
            </div>

            <CommandList className="max-h-60 overflow-y-auto p-1">
              <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                No variables found.
              </CommandEmpty>

              <CommandGroup heading="Available Variables">
                {allVariables.map((item) => {
                  const { Icon, color, bg } = getVariableTypeIcon(item.type);
                  const isSelected =
                    item.path === normalizedValue || item.key === value?.replace(/^\/+/, "");
                  const preview = formatVariableValuePreview(item.value);

                  return (
                    <CommandItem
                      key={`${id}-${item.path}`}
                      value={`${item.path} ${item.key} ${item.type} ${preview}`}
                      onSelect={() => handleSelect(item.path)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer",
                        isSelected && "bg-accent/60 font-medium",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px]",
                            bg,
                          )}
                        >
                          <Icon className={cn("size-3", color)} />
                        </span>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-mono font-medium">{item.path}</span>
                            <Badge
                              variant="outline"
                              className="h-3.5 px-1 text-[8.5px] font-mono shrink-0"
                            >
                              {item.type}
                            </Badge>
                          </div>
                          {preview && (
                            <span className="truncate text-[10px] text-muted-foreground font-mono opacity-80">
                              = {preview}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              {allowCustom && trimmedSearch && !isSearchExactMatch && (
                <CommandGroup heading="Custom Path">
                  <CommandItem
                    value={`custom-${searchNormalized}`}
                    onSelect={() => handleSelect(searchNormalized)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-primary cursor-pointer hover:bg-primary/10"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    <span className="truncate font-mono">
                      Use path: <strong className="font-semibold">{searchNormalized}</strong>
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {addonEnd}
    </div>
  );
}
