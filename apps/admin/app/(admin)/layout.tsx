import { Suspense, type ReactNode } from "react";
import { AdminShell } from "../ui/AdminShell";

function AdminShellFallback() {
  return <div className="h-dvh min-h-dvh w-full bg-kumo-canvas" aria-hidden="true" />;
}

function AdminContentFallback() {
  return <div className="min-h-96 w-full" aria-hidden="true" />;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminShellFallback />}>
      <AdminShell>
        <Suspense fallback={<AdminContentFallback />}>{children}</Suspense>
      </AdminShell>
    </Suspense>
  );
}
