"use client";

import { LinkProvider, Toasty, createKumoToastManager } from "@cloudflare/kumo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NextLink from "next/link";
import { forwardRef, useState, type ReactNode } from "react";
import type { LinkComponentProps } from "@cloudflare/kumo";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href, to, ...props }, ref) => (
  <NextLink ref={ref} href={href ?? to ?? "#"} {...props} />
));
AppLink.displayName = "AppLink";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [toastManager] = useState(() => createKumoToastManager());
  return (
    <QueryClientProvider client={queryClient}>
      <LinkProvider component={AppLink}>
        <Toasty toastManager={toastManager}>{children}</Toasty>
      </LinkProvider>
    </QueryClientProvider>
  );
}
