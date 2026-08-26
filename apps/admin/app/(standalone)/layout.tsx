import { Suspense, type ReactNode } from "react";
import { AdminShell } from "../ui/AdminShell";
import { FullPageSkeleton, PageSkeleton } from "../ui/PageSkeleton";

export default function StandaloneLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
      <AdminShell>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </AdminShell>
    </Suspense>
  );
}
