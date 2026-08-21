import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  ["开发者模式", "⌘1"],
  ["预览模式", "⌘2"],
  ["文档编辑模式", "⌘3"],
  ["撤销 / 重做", "⌘Z / ⇧⌘Z"],
  ["保存", "⌘S"],
  ["复制 JSON 快照", "⌘C"],
  ["关闭菜单或弹窗", "Esc"],
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>快速切换模式和管理当前编辑会话。</DialogDescription>
        <div className="mt-5 grid gap-1.5">
          {shortcuts.map(([label, shortcut]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs"
            >
              <span>{label}</span>
              <kbd className="font-mono text-[10px] text-muted-foreground">{shortcut}</kbd>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            完成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
