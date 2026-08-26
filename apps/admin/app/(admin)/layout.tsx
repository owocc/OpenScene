import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "../ui/AdminShell";
import { FullPageSkeleton, PageSkeleton } from "../ui/PageSkeleton";
import { getServerSessionAndOrganizations } from "../../server/auth";

function AdminShellFallback() {
  return <FullPageSkeleton />;
}

function AdminContentFallback() {
  return <PageSkeleton />;
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
    const requestedSlug = resolvedParams?.orgSlug;
    if (requestedSlug) {
      const isMemberOfRequested = organizations.some((o) => o.slug === requestedSlug);
      if (!isMemberOfRequested) {
        if (organizations.length > 0) {
          const targetOrg =
            activeOrgId && organizations.some((o) => o.id === activeOrgId)
              ? organizations.find((o) => o.id === activeOrgId)!
              : organizations[0];
          redirect(`/${targetOrg.slug}/apps`);
        } else {
          redirect("/");
        }
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
