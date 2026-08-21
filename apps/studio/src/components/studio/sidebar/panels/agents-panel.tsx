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
  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <div>
        <div className="mb-1 text-xs font-semibold text-foreground">App Material Contract</div>
        <p className="text-[11px] text-muted-foreground">
          Studio 通过契约驱动渲染，不维护本地固定组件目录。
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex justify-between border-b border-border/50 py-1">
          <span className="text-muted-foreground">App Key:</span>
          <span className="font-mono font-medium text-foreground">{appKey}</span>
        </div>
        <div className="flex justify-between border-b border-border/50 py-1">
          <span className="text-muted-foreground">协议版本:</span>
          <span className="font-mono text-foreground">{manifestVersion}</span>
        </div>
        <div className="flex justify-between border-b border-border/50 py-1">
          <span className="text-muted-foreground">组件种类:</span>
          <span className="font-medium text-foreground">{componentsCount} 种</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">契约状态:</span>
          <span className={cn("font-semibold", valid ? "text-emerald-500" : "text-amber-500")}>
            {valid ? "Valid" : "Needs review"} · rev {revision}
          </span>
        </div>
      </div>

      {diagnostics.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[11px]">
          <div className="mb-1 font-semibold text-destructive">Contract Diagnostics</div>
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
