import { Check } from "lucide-react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface VariablesPanelProps {
  locale: string;
  locales: string[];
  onLocaleChange: (locale: string) => void;
}

export function VariablesPanel({ locale, locales, onLocaleChange }: VariablesPanelProps) {
  const { LL } = useI18n();

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="mb-1 text-xs font-semibold text-foreground">
          {LL.panels.variables.locales()}
        </div>
        <div className="grid gap-1">
          {locales.map((item) => (
            <button
              key={item}
              className={cn(
                "flex items-center justify-between rounded-lg border p-2 text-xs transition-colors",
                locale === item
                  ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                  : "border-border/60 bg-card hover:bg-muted",
              )}
              onClick={() => onLocaleChange(item)}
            >
              <span>{item}</span>
              {locale === item && <Check className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
