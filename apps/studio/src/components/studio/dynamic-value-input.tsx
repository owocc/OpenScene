import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Code2,
  Globe,
  Type,
  Variable as VariableIcon,
} from "lucide-react";
import {
  dynamicMode,
  dynamicValue,
  dynamicValueText,
  getEditableStatePaths,
  isDynamicValue,
  type DynamicMode,
  type JsonValue,
} from "@/core/document";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudioStore } from "@/stores/studio-store";
import { cn } from "@/lib/utils";
import { VariableCombobox } from "./variable-combobox";
import { TemplateMentionInput } from "./composer-mentions";

export { VariableCombobox } from "./variable-combobox";
export {
  ComposerMenu,
  ComposerMentionItem,
  TemplateMentionInput,
  applyMention,
  findMentionMatch,
} from "./composer-mentions";
function stringValue(value: JsonValue | undefined): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export interface DynamicModeOption {
  key: DynamicMode | "literal";
  label: string;
  shortLabel: string;
  icon: typeof Type;
  colorClass: string;
}

export const MODE_CONFIGS: Record<DynamicMode | "literal", DynamicModeOption> = {
  literal: {
    key: "literal",
    label: "Direct Value (Literal)",
    shortLabel: "Value",
    icon: Type,
    colorClass: "text-muted-foreground",
  },
  state: {
    key: "state",
    label: "State Variable ($state)",
    shortLabel: "State",
    icon: VariableIcon,
    colorClass: "text-primary",
  },
  bindState: {
    key: "bindState",
    label: "Two-Way Bind ($bindState)",
    shortLabel: "Bind",
    icon: ArrowLeftRight,
    colorClass: "text-sky-500",
  },
  template: {
    key: "template",
    label: "Template String ($template)",
    shortLabel: "Tpl",
    icon: Code2,
    colorClass: "text-amber-500",
  },
  i18n: {
    key: "i18n",
    label: "i18n Key ($t)",
    shortLabel: "i18n",
    icon: Globe,
    colorClass: "text-emerald-500",
  },
};

export function DynamicModeDropdown({
  activeMode,
  availableModes,
  onSelectMode,
}: {
  activeMode: DynamicMode | "literal";
  availableModes: Array<DynamicMode | "literal">;
  onSelectMode: (mode: DynamicMode | "literal") => void;
}) {
  const currentConfig = MODE_CONFIGS[activeMode] ?? MODE_CONFIGS.literal;
  const CurrentIcon = currentConfig.icon;

  if (availableModes.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-5.5 items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 text-[10px] text-muted-foreground hover:bg-muted/80 hover:text-foreground font-medium select-none cursor-pointer transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <CurrentIcon className={cn("size-2.5 shrink-0", currentConfig.colorClass)} />
        <span className="max-w-[42px] truncate">{currentConfig.shortLabel}</span>
        <ChevronDown className="size-2 opacity-50 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-xs">
        {availableModes.map((mode) => {
          const cfg = MODE_CONFIGS[mode];
          const Icon = cfg.icon;
          const isSelected = mode === activeMode;
          return (
            <DropdownMenuItem
              key={mode}
              className={cn(
                "flex items-center justify-between gap-2 text-xs cursor-pointer",
                isSelected && "font-semibold bg-accent/50",
              )}
              onClick={() => onSelectMode(mode)}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("size-3.5 shrink-0", cfg.colorClass)} />
                <span>{cfg.label}</span>
              </div>
              {isSelected && <Check className="size-3 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface DynamicValueInputProps {
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  statePaths?: string[];
  supportedModes?: Array<DynamicMode | "literal">;
  translatable?: boolean;
  suggestions?: string[];
  datalistId?: string;
  disabled?: boolean;
  hideModeDropdown?: boolean;
  prefix?: ReactNode;
  autoFocus?: boolean;
}

/**
 * Headless / label-free dynamic value input component.
 * Renders directly as an InputGroup for inline use in table cells, style controls, and string editors.
 */
export function DynamicValueInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName: customInputClassName,
  statePaths: customStatePaths,
  supportedModes = ["literal", "state", "bindState", "template", "i18n"],
  translatable = true,
  suggestions = [],
  datalistId: customDatalistId,
  disabled = false,
  hideModeDropdown = false,
  prefix,
  autoFocus,
}: DynamicValueInputProps) {
  const storeState = useStudioStore((s) => s.document.spec.state);
  const autoId = useId();
  const datalistId = customDatalistId ?? `datalist-${autoId}`;

  const statePaths = useMemo(
    () =>
      customStatePaths ??
      getEditableStatePaths(storeState as Record<string, JsonValue> | undefined),
    [customStatePaths, storeState],
  );

  const availableModes = useMemo(() => {
    const modes = [...supportedModes];
    if (translatable && !modes.includes("i18n")) modes.push("i18n");
    return modes;
  }, [supportedModes, translatable]);

  const mode = dynamicMode(value);
  const activeMode = mode && availableModes.includes(mode) ? mode : "literal";
  const [literalValue, setLiteralValue] = useState<JsonValue | undefined>(
    activeMode === "literal" ? value : "",
  );

  useEffect(() => {
    if (activeMode === "literal" && !isDynamicValue(value)) {
      setLiteralValue(value);
    }
  }, [activeMode, value]);

  const updateLiteral = (next: JsonValue) => {
    setLiteralValue(next);
    onChange(next);
  };

  const handleSwitchMode = (nextMode: DynamicMode | "literal") => {
    if (nextMode === activeMode) return;
    if (nextMode === "literal") {
      onChange(literalValue ?? "");
      return;
    }
    if (nextMode === "state" || nextMode === "bindState") {
      const currentText = isDynamicValue(value) ? dynamicValueText(value) : "";
      const chosen = currentText.trim()
        ? currentText.trim()
        : statePaths.length > 0
          ? statePaths[0]
          : "";
      onChange(dynamicValue(nextMode, chosen));
      return;
    }
    if (nextMode === "template") {
      const currentText = isDynamicValue(value)
        ? dynamicValueText(value)
        : typeof literalValue === "string"
          ? literalValue
          : "";
      onChange({ $template: currentText });
      return;
    }
    if (nextMode === "i18n") {
      const currentText = isDynamicValue(value) ? dynamicValueText(value) : "";
      onChange(dynamicValue("i18n", currentText));
      return;
    }
  };

  const modeDropdown =
    !hideModeDropdown && availableModes.length > 1 ? (
      <DynamicModeDropdown
        activeMode={activeMode}
        availableModes={availableModes}
        onSelectMode={handleSwitchMode}
      />
    ) : null;

  if (activeMode === "state" || activeMode === "bindState") {
    const rawVal = isDynamicValue(value) ? dynamicValueText(value) : "";
    return (
      <div className={cn("flex items-center gap-1 min-w-0 flex-1", className)}>
        <VariableCombobox
          value={rawVal}
          statePaths={statePaths}
          placeholder={statePaths[0] ?? "/variableName"}
          onChange={(newPath) => onChange(dynamicValue(activeMode, newPath))}
          disabled={disabled}
          buttonClassName={customInputClassName}
          addonEnd={modeDropdown}
        />
      </div>
    );
  }

  if (activeMode === "template") {
    const rawVal = isDynamicValue(value) ? dynamicValueText(value) : "";
    return (
      <TemplateMentionInput
        value={rawVal}
        onChange={(nextVal) => onChange({ $template: nextVal })}
        placeholder={placeholder ?? "Hello, ${/name}!"}
        className={className}
        inputClassName={customInputClassName}
        statePaths={statePaths}
        disabled={disabled}
        autoFocus={autoFocus}
        addonEnd={modeDropdown}
      />
    );
  }

  if (activeMode === "i18n") {
    const rawVal = isDynamicValue(value) ? dynamicValueText(value) : "";
    return (
      <InputGroup className={cn("h-8", className)}>
        <InputGroupAddon align="inline-start" className="pe-1 text-emerald-500">
          <Globe className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          value={rawVal}
          placeholder="greeting"
          onChange={(event) => onChange(dynamicValue("i18n", event.target.value))}
          className={cn("font-mono text-xs", customInputClassName)}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {modeDropdown && <InputGroupAddon align="inline-end">{modeDropdown}</InputGroupAddon>}
      </InputGroup>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <InputGroup className={cn("h-8", className)}>
        {prefix && (
          <InputGroupAddon align="inline-start" className="pe-1">
            {prefix}
          </InputGroupAddon>
        )}
        <InputGroupInput
          list={suggestions.length > 0 ? datalistId : undefined}
          placeholder={placeholder}
          value={stringValue(literalValue)}
          onChange={(event) => updateLiteral(event.target.value)}
          className={cn("text-xs", customInputClassName)}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {modeDropdown && <InputGroupAddon align="inline-end">{modeDropdown}</InputGroupAddon>}
      </InputGroup>
      {suggestions.length > 0 && (
        <datalist id={datalistId}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </div>
  );
}
