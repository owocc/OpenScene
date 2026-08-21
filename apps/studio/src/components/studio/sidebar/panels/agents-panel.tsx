import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface AgentsPanelProps {
  appKey: string;
  manifestVersion: string;
  componentsCount: number;
  valid: boolean;
  revision: number;
  diagnostics: Array<{ message: string }>;
}

export function AgentsPanel({
  appKey,
  manifestVersion,
  componentsCount,
  valid,
  revision,
  diagnostics,
}: AgentsPanelProps) {
  const { LL } = useI18n();

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <div>
        <div className="mb-1 text-xs font-semibold text-foreground">{LL.panels.agents.title()}</div>
        <p className="text-[11px] text-muted-foreground">{LL.panels.agents.description()}</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex justify-between border-b border-border/50 py-1">
          <span className="text-muted-foreground">{LL.panels.agents.appKey()}:</span>
          <span className="font-mono font-medium text-foreground">{appKey}</span>
        </div>
        <div className="flex justify-between border-b border-border/50 py-1">
          <span className="text-muted-foreground">{LL.panels.agents.manifestVersion()}:</span>
          <span className="font-mono text-foreground">{manifestVersion}</span>
        </div>
        <div className="flex justify-between border-b border-border/50 py-1">
          <span className="text-muted-foreground">{LL.panels.agents.componentTypes()}:</span>
          <span className="font-medium text-foreground">
            {LL.panels.agents.componentCount({ count: componentsCount })}
          </span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">{LL.panels.agents.status()}:</span>
          <span className={cn("font-semibold", valid ? "text-emerald-500" : "text-amber-500")}>
            {valid ? LL.panels.agents.valid() : LL.panels.agents.needsReview()} ·{" "}
            {LL.panels.agents.rev({ rev: revision })}
          </span>
        </div>
      </div>

      {diagnostics.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[11px]">
          <div className="mb-1 font-semibold text-destructive">
            {LL.panels.agents.diagnostics()}
          </div>
          <div className="grid gap-1 text-muted-foreground">
            {diagnostics.map((d, i) => (
              <div key={i}>• {d.message}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
