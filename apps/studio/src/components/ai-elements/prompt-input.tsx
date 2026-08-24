import * as React from "react";
import { ArrowUp, Camera, Paperclip, Plus, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PromptInputAttachmentFile {
  id: string;
  type: "file";
  filename?: string;
  mediaType?: string;
  url: string;
  dataUrl?: string;
  size?: number;
}

export interface PromptInputMessage {
  text: string;
  files?: PromptInputAttachmentFile[];
}

interface PromptInputContextValue {
  text: string;
  setText: (text: string) => void;
  files: PromptInputAttachmentFile[];
  addFiles: (newFiles: PromptInputAttachmentFile[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  onSubmit?: (message: PromptInputMessage) => void;
  status: "ready" | "submitted" | "streaming" | "error";
  setStatus: (status: "ready" | "submitted" | "streaming" | "error") => void;
  onStop?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(null);

export function usePromptInput() {
  const ctx = React.useContext(PromptInputContext);
  if (!ctx) {
    throw new Error("usePromptInput must be used within a PromptInputProvider");
  }
  return ctx;
}

export function usePromptInputAttachments() {
  const ctx = usePromptInput();
  return {
    files: ctx.files,
    add: ctx.addFiles,
    remove: ctx.removeFile,
    clear: ctx.clearFiles,
  };
}

export function PromptInputProvider({
  children,
  initialText = "",
  status: controlledStatus,
  onStop,
}: {
  children: React.ReactNode;
  initialText?: string;
  status?: "ready" | "submitted" | "streaming" | "error";
  onStop?: () => void;
}) {
  const [text, setText] = React.useState(initialText);
  const [files, setFiles] = React.useState<PromptInputAttachmentFile[]>([]);
  const [internalStatus, setInternalStatus] = React.useState<
    "ready" | "submitted" | "streaming" | "error"
  >("ready");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const status = controlledStatus ?? internalStatus;
  const setStatus = React.useCallback((s: "ready" | "submitted" | "streaming" | "error") => {
    setInternalStatus(s);
  }, []);

  const addFiles = React.useCallback((newFiles: PromptInputAttachmentFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = React.useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = React.useCallback(() => {
    setFiles([]);
  }, []);

  const value = React.useMemo<PromptInputContextValue>(
    () => ({
      text,
      setText,
      files,
      addFiles,
      removeFile,
      clearFiles,
      status,
      setStatus,
      onStop,
      fileInputRef,
    }),
    [text, files, addFiles, removeFile, clearFiles, status, setStatus, onStop],
  );

  return <PromptInputContext.Provider value={value}>{children}</PromptInputContext.Provider>;
}

export interface PromptInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  onSubmit?: (message: PromptInputMessage) => void;
  globalDrop?: boolean;
  multiple?: boolean;
  accept?: string;
}

export function PromptInput({
  className,
  children,
  onSubmit,
  globalDrop,
  multiple = true,
  accept = "image/*,.json,.txt,.md,.pdf,.csv",
  ...props
}: PromptInputProps) {
  const { text, setText, files, clearFiles, fileInputRef, addFiles } = usePromptInput();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newAttachments: PromptInputAttachmentFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const url = URL.createObjectURL(file);
      newAttachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: "file",
        filename: file.name,
        mediaType: file.type,
        size: file.size,
        url,
      });
    }
    addFiles(newAttachments);
    e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      const hasText = Boolean(text.trim());
      const hasFiles = files.length > 0;
      if (hasText || hasFiles) {
        e.preventDefault();
        onSubmit?.({ text: text.trim(), files });
        setText("");
        clearFiles();
      }
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border border-border/80 bg-muted/20 p-2 shadow-xs transition-all focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20",
        className,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      {children}
    </div>
  );
}

export function PromptInputBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function PromptInputTextarea({
  className,
  placeholder = "Ask something or describe UI changes (Shift+Enter to send)…",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { text, setText } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [text]);

  return (
    <textarea
      rows={1}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      className={cn(
        "max-h-48 min-h-[32px] w-full resize-none border-0 bg-transparent px-1.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/70 outline-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

export function PromptInputFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between gap-1.5 pt-1", className)} {...props}>
      {children}
    </div>
  );
}

export function PromptInputTools({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)} {...props}>
      {children}
    </div>
  );
}

export const PromptInputButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "ghost", size = "xs", children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "gap-1 px-2 font-normal text-muted-foreground hover:text-foreground",
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </Button>
  );
});
PromptInputButton.displayName = "PromptInputButton";

export function PromptInputActionMenu({ children }: { children: React.ReactNode }) {
  return <DropdownMenu>{children}</DropdownMenu>;
}

export function PromptInputActionMenuTrigger({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn("text-muted-foreground hover:text-foreground", className)}
          type="button"
        >
          {children ?? <Plus className="size-3.5" />}
        </Button>
      }
    />
  );
}

export function PromptInputActionMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent align="start" className={cn("w-44 text-xs", className)} {...props}>
      {children}
    </DropdownMenuContent>
  );
}

export function PromptInputActionAddAttachments({ onSelect }: { onSelect?: () => void }) {
  const { fileInputRef } = usePromptInput();
  return (
    <DropdownMenuItem
      className="gap-2 text-xs"
      onClick={() => {
        onSelect?.();
        fileInputRef.current?.click();
      }}
    >
      <Paperclip className="size-3.5" />
      <span>Add attachments</span>
    </DropdownMenuItem>
  );
}

export function PromptInputActionAddScreenshot({ onSelect }: { onSelect?: () => void }) {
  return (
    <DropdownMenuItem
      className="gap-2 text-xs"
      onClick={() => {
        onSelect?.();
      }}
    >
      <Camera className="size-3.5" />
      <span>Add screenshot</span>
    </DropdownMenuItem>
  );
}

export function PromptInputSubmit({
  status: propStatus,
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & {
  status?: "ready" | "submitted" | "streaming" | "error";
}) {
  const { status: ctxStatus, text, files, onStop } = usePromptInput();
  const currentStatus = propStatus ?? ctxStatus;
  const isStreaming = currentStatus === "streaming" || currentStatus === "submitted";
  const hasContent = Boolean(text.trim()) || files.length > 0;

  if (isStreaming) {
    return (
      <Button
        variant="destructive"
        size="icon-xs"
        type="button"
        className={cn("rounded-lg shadow-xs", className)}
        onClick={onStop}
        title="Stop generation"
        {...props}
      >
        <Square className="size-3 fill-current" />
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="icon-xs"
      type="submit"
      disabled={disabled ?? !hasContent}
      className={cn("rounded-lg shadow-xs", className)}
      title="Send message"
      {...props}
    >
      <ArrowUp className="size-3.5" />
    </Button>
  );
}
