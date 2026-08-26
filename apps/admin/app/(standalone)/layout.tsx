import { Suspense, type ReactNode } from "react";

function StandaloneFallback() {
  return <div className="h-dvh min-h-dvh w-full bg-kumo-canvas" aria-hidden="true" />;
}

export default function StandaloneLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-kumo-canvas text-kumo-default flex flex-col justify-center items-center p-4 sm:p-6">
      <Suspense fallback={<StandaloneFallback />}>{children}</Suspense>
    </div>
  );
}
