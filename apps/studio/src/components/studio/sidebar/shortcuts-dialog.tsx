import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const { LL } = useI18n();

  const shortcuts = [
    [LL.shortcuts.developerMode(), "⌘1"],
    [LL.shortcuts.previewMode(), "⌘2"],
    [LL.shortcuts.textMode(), "⌘3"],
    [LL.shortcuts.undoRedo(), "⌘Z / ⇧⌘Z"],
    [LL.shortcuts.save(), "⌘S"],
    [LL.shortcuts.copyJson(), "⌘C"],
    [LL.shortcuts.close(), "Esc"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{LL.shortcuts.title()}</DialogTitle>
        <DialogDescription>{LL.shortcuts.description()}</DialogDescription>
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
            {LL.common.done()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
