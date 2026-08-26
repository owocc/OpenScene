import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "../ui/AdminShell";
import { getServerSessionAndOrganizations } from "../../server/auth";

function AdminShellFallback() {
  return <div className="h-dvh min-h-dvh w-full bg-kumo-canvas" aria-hidden="true" />;
}

function AdminContentFallback() {
  return <div className="min-h-96 w-full" aria-hidden="true" />;
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params?: Promise<{ orgSlug?: string }>;
}) {
  const resolvedParams = params ? await params : undefined;
  const { isAuthenticated, isAuthDisabled, organizations, activeOrgId } =
    await getServerSessionAndOrganizations();

  if (!isAuthenticated && !isAuthDisabled) {
    redirect("/login");
  }

  if (!isAuthDisabled) {
    if (organizations.length === 0) {
      redirect("/organization/select");
    }

    const requestedSlug = resolvedParams?.orgSlug;
    if (requestedSlug) {
      const isMemberOfRequested = organizations.some((o) => o.slug === requestedSlug);
      if (!isMemberOfRequested) {
        const targetOrg =
          activeOrgId && organizations.some((o) => o.id === activeOrgId)
            ? organizations.find((o) => o.id === activeOrgId)!
            : organizations[0];
        redirect(`/${targetOrg.slug}/apps`);
      }
    }
  }

  return (
    <Suspense fallback={<AdminShellFallback />}>
      <AdminShell>
        <Suspense fallback={<AdminContentFallback />}>{children}</Suspense>
      </AdminShell>
    </Suspense>
  );
}
