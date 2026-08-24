import * as React from "react";
import { FileText, Image as ImageIcon, MousePointerClick, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface AttachmentData {
  id: string;
  type?: "file" | string;
  filename?: string;
  mediaType?: string;
  url?: string;
  size?: number;
}

interface AttachmentContextValue {
  data: AttachmentData;
  onRemove?: () => void;
}

const AttachmentContext = React.createContext<AttachmentContextValue | null>(null);

export function useAttachment() {
  const ctx = React.useContext(AttachmentContext);
  if (!ctx) {
    throw new Error("useAttachment must be used within an Attachment component");
  }
  return ctx;
}

export function Attachments({
  className,
  variant = "inline",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "inline" | "grid" }) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 pb-1",
        variant === "grid" ? "grid grid-cols-2" : "flex-row",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Attachment({
  data,
  onRemove,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  data: AttachmentData;
  onRemove?: () => void;
}) {
  return (
    <AttachmentContext.Provider value={{ data, onRemove }}>
      <div
        className={cn(
          "group relative flex max-w-[180px] items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-2 py-1 text-xs text-foreground shadow-2xs backdrop-blur",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AttachmentContext.Provider>
  );
}

export function AttachmentPreview({ className }: { className?: string }) {
  const { data } = useAttachment();
  const isImage =
    data.mediaType?.startsWith("image/") || data.url?.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
  const isElement = data.type === "element" || data.type === "component";

  if (isImage && data.url) {
    return (
      <div
        className={cn(
          "size-6 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted",
          className,
        )}
      >
        <img
          src={data.url}
          alt={data.filename || "attachment"}
          className="size-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
        className,
      )}
    >
      {isElement ? (
        <MousePointerClick className="size-3.5 text-primary" />
      ) : data.mediaType?.startsWith("image/") ? (
        <ImageIcon className="size-3.5 text-blue-500" />
      ) : (
        <FileText className="size-3.5" />
      )}
    </div>
  );
}

export function AttachmentRemove({ className }: { className?: string }) {
  const { onRemove } = useAttachment();
  if (!onRemove) return null;

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn(
        "size-4 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      onClick={onRemove}
      type="button"
      title="Remove attachment"
    >
      <X className="size-2.5" />
    </Button>
  );
}

export function AttachmentName({ className }: { className?: string }) {
  const { data } = useAttachment();
  return (
    <span className={cn("truncate font-medium text-[11px]", className)}>
      {data.filename || "Attachment"}
    </span>
  );
}
