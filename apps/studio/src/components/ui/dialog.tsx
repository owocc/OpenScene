import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogBackdrop({ className, ...props }: ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn("fixed inset-0 z-50 bg-slate-950/25 backdrop-blur-[2px]", className)}
      {...props}
    />
  );
}

function DialogViewport({ className, ...props }: ComponentProps<typeof DialogPrimitive.Viewport>) {
  return (
    <DialogPrimitive.Viewport
      data-slot="dialog-viewport"
      className={cn("fixed inset-0 z-50 grid place-items-center p-4", className)}
      {...props}
    />
  );
}

function DialogPopup({ className, ...props }: ComponentProps<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPrimitive.Popup
      data-slot="dialog-popup"
      className={cn(
        "w-full max-w-md rounded-2xl border border-border bg-background p-5 text-foreground shadow-2xl shadow-slate-950/15 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-sm font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("mt-1 text-xs leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

function DialogClose({ className, ...props }: ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(
        "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
};
