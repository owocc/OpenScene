import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Zap } from "lucide-react";

import { COMPONENT_DRAG_MIME } from "@openscene-ai/core";
import { useI18n } from "@/i18n";
import type { ComponentMeta } from "@/core/meta";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ActionsTab = "all" | "components";

interface ActionsPopoverProps {
  components: ComponentMeta[];
  onAddComponent: (type: string) => void;
}

export function ActionsPopover({ components, onAddComponent }: ActionsPopoverProps) {
  const { LL } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActionsTab>("all");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredComponents = useMemo(() => {
    if (!normalizedQuery) return components;
    return components.filter((component) =>
      [component.title, component.type, component.category ?? "", ...(component.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [components, normalizedQuery]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveTab("all");
    }
  };

  const insertComponent = (type: string) => {
    onAddComponent(type);
    setOpen(false);
    setQuery("");
    setActiveTab("all");
  };

  const noComponents = filteredComponents.length === 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none"
        aria-label={LL.toolbar.actions()}
      >
        <Zap aria-hidden="true" className="size-4" />
        <span>{LL.toolbar.actions()}</span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-[min(560px,calc(100vw-2rem))] gap-0 p-0"
      >
        <Command shouldFilter={false} className="gap-1">
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder={LL.common.searchComponent()}
          />
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value === "components" ? "components" : "all")}
            className="gap-1 p-1"
          >
            <TabsList className="w-full">
              <TabsTrigger value="all">{LL.toolbar.all()}</TabsTrigger>
              <TabsTrigger value="components">{LL.toolbar.components()}</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <CommandList className="max-h-72">
                {noComponents ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {LL.toolbar.noComponents()}
                  </div>
                ) : (
                  filteredComponents.map((component) => (
                    <CommandItem
                      key={component.type}
                      value={component.type}
                      onSelect={() => insertComponent(component.type)}
                      className="gap-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
                        <Box aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{component.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {component.type}
                      </span>
                    </CommandItem>
                  ))
                )}
              </CommandList>
            </TabsContent>
            <TabsContent value="components">
              {noComponents ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {LL.toolbar.noComponents()}
                </div>
              ) : (
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-1">
                  {filteredComponents.map((component) => (
                    <button
                      key={component.type}
                      type="button"
                      draggable
                      ref={(element) => {
                        // The popover renders in a portal; React's delegated
                        // drag handlers miss events dispatched there, so bind
                        // the data transfer natively on the element itself.
                        if (element && !element.dataset.dragBound) {
                          element.dataset.dragBound = "true";
                          element.addEventListener("dragstart", (event) => {
                            event.dataTransfer?.setData(COMPONENT_DRAG_MIME, component.type);
                            if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
                            // Cross-origin iframes can't read the drag data,
                            // so Studio also keeps the pending type globally.
                            (
                              window as unknown as Record<string, string | null>
                            ).__opensceneDraggingComponent = component.type;
                          });
                          element.addEventListener("dragend", () => {
                            (
                              window as unknown as Record<string, string | null>
                            ).__opensceneDraggingComponent = null;
                          });
                        }
                      }}
                      className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
                      onClick={() => insertComponent(component.type)}
                    >
                      <span className="grid aspect-square w-full place-items-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
                        <Box aria-hidden="true" className="size-6" />
                      </span>
                      <span className="flex w-full min-w-0 flex-col gap-0.5">
                        <span className="truncate text-xs font-semibold">{component.title}</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {component.type}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
