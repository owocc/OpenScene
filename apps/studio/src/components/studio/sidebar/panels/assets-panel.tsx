import { useState } from "react";
import { Plus, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import type { ComponentMeta } from "@/core/meta";

interface AssetsPanelProps {
  components: ComponentMeta[];
  onSelectComponent: (type: string) => void;
}

export function AssetsPanel({ components, onSelectComponent }: AssetsPanelProps) {
  const { LL } = useI18n();
  const [search, setSearch] = useState("");

  const filtered = components.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col p-3">
      <div className="mb-2">
        <div className="relative">
          <Search className="absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
          <input
            className="h-8 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-xs outline-none focus-visible:border-ring"
            placeholder={LL.common.searchComponent()}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        {filtered.map((c) => (
          <button
            key={c.type}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => onSelectComponent(c.type)}
          >
            <div>
              <div className="text-xs font-semibold">{c.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{c.type}</div>
            </div>
            <Plus className="size-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
