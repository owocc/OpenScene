"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Braces,
  CircleSlash,
  Code2,
  Hash,
  List,
  ToggleLeft,
  Type,
  Variable as VariableIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { getStateVariables, type JsonValue, type StateVariableType } from "@/core/document";
import { useStudioStore } from "@/stores/studio-store";

export interface MentionVariableItem {
  key: string;
  path: string;
  type: StateVariableType | (string & {});
  value?: JsonValue;
}

export interface MentionMatchResult {
  isMentioning: boolean;
  query: string;
  matchStart: number;
  matchEnd: number;
  matches: MentionVariableItem[];
}

export function getVariableTypeIcon(type: StateVariableType | (string & {}) | undefined) {
  switch (type) {
    case "string":
      return {
        Icon: Type,
        color: "text-sky-500",
        bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      };
    case "number":
      return {
        Icon: Hash,
        color: "text-amber-500",
        bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    case "boolean":
      return {
        Icon: ToggleLeft,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "object":
      return {
        Icon: Braces,
        color: "text-purple-500",
        bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      };
    case "array":
      return {
        Icon: List,
        color: "text-indigo-500",
        bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      };
    case "null":
      return {
        Icon: CircleSlash,
        color: "text-muted-foreground",
        bg: "bg-muted text-muted-foreground",
      };
    default:
      return {
        Icon: VariableIcon,
        color: "text-primary",
        bg: "bg-primary/10 text-primary",
      };
  }
}

export function formatVariableValuePreview(val: JsonValue | undefined): string {
  if (val === undefined) return "";
  if (val === null) return "null";
  if (typeof val === "string") return `"${val.length > 20 ? val.slice(0, 20) + "…" : val}"`;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === "object") return "{…}";
  return String(val);
}

/**
 * Finds @mention matches before the caret in a string.
 */
export function findMentionMatch(
  text: string,
  cursorPos: number,
  variables: readonly MentionVariableItem[],
): MentionMatchResult {
  const safeCursor = Math.max(0, Math.min(cursorPos, text.length));
  const textBefore = text.slice(0, safeCursor);

  // Match @variable query right before the cursor
  const match = /(?:^|\s|["'`({[])@([a-zA-Z0-9_\-/]*)$/.exec(textBefore);
  if (!match) {
    return {
      isMentioning: false,
      query: "",
      matchStart: -1,
      matchEnd: -1,
      matches: [],
    };
  }

  const query = match[1] || "";
  const atCharIndexInMatch = match[0].lastIndexOf("@");
  const matchStart = match.index + atCharIndexInMatch;
  const matchEnd = safeCursor;
  const lowerQuery = query.toLowerCase().replace(/^\/+/, "");

  const filtered = variables.filter((v) => {
    const cleanKey = v.key.toLowerCase().replace(/^\/+/, "");
    const cleanPath = v.path.toLowerCase().replace(/^\/+/, "");
    return cleanKey.includes(lowerQuery) || cleanPath.includes(lowerQuery);
  });

  return {
    isMentioning: true,
    query,
    matchStart,
    matchEnd,
    matches: filtered,
  };
}

/**
 * Replaces the @mention range with ${/variableName} syntax and returns the next text & cursor position.
 */
export function applyMention(
  text: string,
  matchStart: number,
  matchEnd: number,
  variable: MentionVariableItem,
): { nextText: string; nextCursor: number } {
  const normalizedPath = variable.path.startsWith("/") ? variable.path : `/${variable.path}`;
  const insertToken = `\${${normalizedPath}}`;
  const nextText = text.slice(0, matchStart) + insertToken + text.slice(matchEnd);
  const nextCursor = matchStart + insertToken.length;
  return { nextText, nextCursor };
}

export function ComposerMenu({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      data-slot="composer-menu"
      className={cn(
        "absolute start-0 bottom-full z-50 mb-1.5 flex w-72 max-w-[calc(100vw-32px)] flex-col gap-0.5 rounded-xl border border-border/80 bg-popover/95 p-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md duration-150 animate-in fade-in-0 zoom-in-95",
        className,
      )}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between px-2 py-1 text-[10px] font-medium text-muted-foreground border-b border-border/50">
        <span className="flex items-center gap-1">
          <VariableIcon className="size-3 text-primary" />
          <span>Insert Variable</span>
        </span>
        <span className="text-[9px] opacity-70">↑↓ Navigate · ↵ Select</span>
      </div>
      <div className="max-h-48 overflow-y-auto overscroll-contain py-0.5 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

export function ComposerMentionItem({
  item,
  active = false,
  onClick,
}: {
  item: MentionVariableItem;
  active?: boolean;
  onClick: () => void;
}) {
  const { Icon, color, bg } = getVariableTypeIcon(item.type);
  const valuePreview = formatVariableValuePreview(item.value);

  return (
    <button
      type="button"
      data-slot="composer-mention-item"
      data-active={active || undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left cursor-pointer transition-colors select-none",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-foreground hover:bg-muted/60",
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px]",
          bg,
        )}
      >
        <Icon className={cn("size-3", color)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-mono font-medium">{item.path}</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono shrink-0">
            {item.type}
          </Badge>
        </div>
        {valuePreview && (
          <span className="truncate text-[10px] text-muted-foreground font-mono opacity-80">
            = {valuePreview}
          </span>
        )}
      </div>
    </button>
  );
}

export interface TemplateMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  statePaths?: string[];
  variables?: MentionVariableItem[];
  addonEnd?: ReactNode;
}

/**
 * Enhanced template string editor supporting `@` variable mentions,
 * keyboard navigation, and seamless ${/var} insertion.
 */
export function TemplateMentionInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  disabled = false,
  autoFocus,
  statePaths: customStatePaths,
  variables: customVariables,
  addonEnd,
}: TemplateMentionInputProps) {
  const storeState = useStudioStore((s) => s.document.spec.state);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const menuId = useId();

  const allVariables: MentionVariableItem[] = useMemo(() => {
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

  const mentionResult = useMemo(() => {
    if (menuDismissed || cursorPos === null) {
      return { isMentioning: false, query: "", matchStart: -1, matchEnd: -1, matches: [] };
    }
    return findMentionMatch(value, cursorPos, allVariables);
  }, [value, cursorPos, allVariables, menuDismissed]);

  const isOpen = mentionResult.isMentioning && mentionResult.matches.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [mentionResult.query]);

  const handleSelectMention = useCallback(
    (item: MentionVariableItem) => {
      const { nextText, nextCursor } = applyMention(
        value,
        mentionResult.matchStart,
        mentionResult.matchEnd,
        item,
      );
      onChange(nextText);
      setMenuDismissed(true);

      // Restore cursor position after insertion
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(nextCursor, nextCursor);
          setCursorPos(nextCursor);
        }
      });
    },
    [value, mentionResult.matchStart, mentionResult.matchEnd, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % mentionResult.matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (prev) => (prev - 1 + mentionResult.matches.length) % mentionResult.matches.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (mentionResult.matches[activeIndex]) {
          e.preventDefault();
          handleSelectMention(mentionResult.matches[activeIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuDismissed(true);
        return;
      }
    }
  };

  const handleTriggerAt = () => {
    if (disabled || !inputRef.current) return;
    const input = inputRef.current;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const nextText = value.slice(0, start) + "@" + value.slice(end);
    const nextCursor = start + 1;
    onChange(nextText);
    setMenuDismissed(false);

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
      setCursorPos(nextCursor);
    });
  };

  return (
    <div className="relative min-w-0 flex-1">
      <InputGroup className={cn("h-8", className)}>
        <InputGroupAddon align="inline-start" className="pe-1 text-amber-500">
          <Code2 className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          value={value}
          placeholder={placeholder ?? "Type text or @ to pick variable…"}
          onChange={(e) => {
            setMenuDismissed(false);
            setCursorPos(e.target.selectionStart);
            onChange(e.target.value);
          }}
          onSelect={(e) => {
            const target = e.target as HTMLInputElement;
            setCursorPos(target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Small timeout to allow click selections
            setTimeout(() => {
              setCursorPos(null);
            }, 200);
          }}
          className={cn("font-mono text-xs", inputClassName)}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <InputGroupAddon align="inline-end" className="gap-1">
          <InputGroupButton
            type="button"
            size="icon-xs"
            variant="ghost"
            title="Type @ to insert state variable"
            onClick={handleTriggerAt}
            disabled={disabled}
            className="h-5 px-1 font-mono text-[11px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
          >
            @
          </InputGroupButton>
          {addonEnd}
        </InputGroupAddon>
      </InputGroup>

      {/* Assistant-UI style Composer Mentions Menu */}
      <ComposerMenu open={isOpen}>
        {mentionResult.matches.map((item, idx) => (
          <ComposerMentionItem
            key={`${menuId}-${item.path}`}
            item={item}
            active={idx === activeIndex}
            onClick={() => handleSelectMention(item)}
          />
        ))}
      </ComposerMenu>
    </div>
  );
}
