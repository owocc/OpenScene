import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function renderInline(text: string): ReactNode[] {
  // Regex to split inline tokens: code, bold, italic, strikethrough, links
  const tokenRegex =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px] font-medium text-foreground border border-border/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold (**text** or __text__)
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic (*text* or _text_)
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Strikethrough (~~text~~)
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      return (
        <del key={index} className="line-through text-muted-foreground">
          {part.slice(2, -2)}
        </del>
      );
    }

    // Link ([text](url))
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 overflow-hidden rounded-xl border border-border/70 bg-zinc-950 text-zinc-100 shadow-sm">
      <div className="flex h-7 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 text-[10px] text-zinc-400">
        <span className="font-mono">{language || "code"}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="text-emerald-400" /> : <Copy />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null;

  // 1. Split into code blocks vs non-code segments
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const sections: Array<
    { type: "code"; language: string; code: string } | { type: "text"; text: string }
  > = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      sections.push({ type: "text", text: content.slice(lastIndex, match.index) });
    }
    sections.push({
      type: "code",
      language: match[1] || "",
      code: match[2].trim(),
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    sections.push({ type: "text", text: content.slice(lastIndex) });
  }

  return (
    <div className={cn("text-xs leading-relaxed text-foreground space-y-2", className)}>
      {sections.map((section, sIdx) => {
        if (section.type === "code") {
          return <CodeBlock key={sIdx} code={section.code} language={section.language} />;
        }

        // Parse lines in text section
        const lines = section.text.split("\n");
        const renderedElements: ReactNode[] = [];
        let listBuffer: Array<{ type: "ul" | "ol"; text: string; num?: string }> = [];

        const flushList = () => {
          if (listBuffer.length === 0) return;
          const isOrdered = listBuffer[0]?.type === "ol";
          if (isOrdered) {
            renderedElements.push(
              <ol
                key={`ol-${renderedElements.length}`}
                className="my-1.5 ml-4 list-decimal space-y-0.5"
              >
                {listBuffer.map((item, i) => (
                  <li key={i} className="text-xs leading-relaxed text-foreground">
                    {renderInline(item.text)}
                  </li>
                ))}
              </ol>,
            );
          } else {
            renderedElements.push(
              <ul
                key={`ul-${renderedElements.length}`}
                className="my-1.5 ml-4 list-disc space-y-0.5"
              >
                {listBuffer.map((item, i) => (
                  <li key={i} className="text-xs leading-relaxed text-foreground">
                    {renderInline(item.text)}
                  </li>
                ))}
              </ul>,
            );
          }
          listBuffer = [];
        };

        for (let i = 0; i < lines.length; i++) {
          const rawLine = lines[i];
          const line = rawLine.trim();

          if (!line) {
            flushList();
            continue;
          }

          // Unordered list item (- item, * item)
          const ulMatch = line.match(/^[-*]\s+(.*)$/);
          if (ulMatch) {
            if (listBuffer.length > 0 && listBuffer[0]?.type !== "ul") flushList();
            listBuffer.push({ type: "ul", text: ulMatch[1] });
            continue;
          }

          // Ordered list item (1. item)
          const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
          if (olMatch) {
            if (listBuffer.length > 0 && listBuffer[0]?.type !== "ol") flushList();
            listBuffer.push({ type: "ol", text: olMatch[2], num: olMatch[1] });
            continue;
          }

          flushList();

          // Heading 1 (# ...)
          if (line.startsWith("# ")) {
            renderedElements.push(
              <h1 key={`h1-${i}`} className="mt-3 mb-1.5 text-sm font-bold text-foreground">
                {renderInline(line.slice(2))}
              </h1>,
            );
            continue;
          }

          // Heading 2 (## ...)
          if (line.startsWith("## ")) {
            renderedElements.push(
              <h2 key={`h2-${i}`} className="mt-2.5 mb-1 text-[13px] font-semibold text-foreground">
                {renderInline(line.slice(3))}
              </h2>,
            );
            continue;
          }

          // Heading 3 (### ...)
          if (line.startsWith("### ")) {
            renderedElements.push(
              <h3 key={`h3-${i}`} className="mt-2 mb-1 text-xs font-semibold text-foreground">
                {renderInline(line.slice(4))}
              </h3>,
            );
            continue;
          }

          // Blockquote (> ...)
          if (line.startsWith("> ")) {
            renderedElements.push(
              <blockquote
                key={`bq-${i}`}
                className="my-1.5 border-l-2 border-primary/40 pl-2.5 italic text-muted-foreground text-[11px]"
              >
                {renderInline(line.slice(2))}
              </blockquote>,
            );
            continue;
          }

          // Regular paragraph
          renderedElements.push(
            <p key={`p-${i}`} className="my-1 text-xs leading-relaxed text-foreground">
              {renderInline(line)}
            </p>,
          );
        }

        flushList();
        return <div key={sIdx}>{renderedElements}</div>;
      })}
    </div>
  );
}
