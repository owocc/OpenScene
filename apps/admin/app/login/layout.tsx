import { Suspense, type ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="min-h-dvh" />}>{children}</Suspense>;
}
