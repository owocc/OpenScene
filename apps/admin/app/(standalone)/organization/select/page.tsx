"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Text } from "@cloudflare/kumo/components/text";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Plus } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  authClient,
  signOut,
  useActiveOrganization,
  useListOrganizations,
  useSession,
} from "@/lib/auth-client";
import { useI18n } from "../../../ui/i18n";
import { buildHref } from "../../../ui/navigation";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "org"
  );
}

export default function StandaloneOrganizationSelectPage() {
  const router = useRouter();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const { data: orgs, isPending: loadingOrgs } = useListOrganizations();
  const { data: activeOrg } = useActiveOrganization();

  const [userInvitations, setUserInvitations] = useState<
    Array<{
      id: string;
      organizationName?: string;
      organizationId: string;
      role: string;
      status: string;
    }>
  >([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Inline creation for first organization
  const [firstOrgName, setFirstOrgName] = useState("");
  const [firstOrgSlug, setFirstOrgSlug] = useState("");
  const [creatingFirstOrg, setCreatingFirstOrg] = useState(false);
  const [firstOrgError, setFirstOrgError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionPending && !session?.user) {
      router.replace("/login?next=/organization/select");
    }
  }, [session, sessionPending, router]);

  const loadUserInvitations = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const res = await authClient.organization.listUserInvitations();
      if (res?.data) {
        setUserInvitations(
          res.data as unknown as Array<{
            id: string;
            organizationName?: string;
            organizationId: string;
            role: string;
            status: string;
          }>,
        );
      }
    } catch {
      // ignore
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    void loadUserInvitations();
  }, [loadUserInvitations]);

  const orgList = (orgs ?? []) as Array<{ id: string; name: string; slug: string }>;

  // If exactly 1 organization and no pending invitations, auto-enter
  useEffect(() => {
    if (
      !sessionPending &&
      !loadingOrgs &&
      !loadingInvites &&
      orgList.length === 1 &&
      userInvitations.length === 0
    ) {
      const soleOrg = orgList[0];
      void authClient.organization.setActive({ organizationId: soleOrg.id });
      window.location.href = buildHref("/apps", { orgSlug: soleOrg.slug });
    }
  }, [sessionPending, loadingOrgs, loadingInvites, orgList, userInvitations]);

  async function handleEnter(org: { id: string; slug: string }) {
    try {
      await authClient.organization.setActive({ organizationId: org.id });
      void queryClient.invalidateQueries();
      window.location.href = buildHref("/apps", { orgSlug: org.slug });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAcceptInvite(invitationId: string) {
    try {
      await authClient.organization.acceptInvitation({ invitationId });
      await loadUserInvitations();
      void queryClient.invalidateQueries();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRejectInvite(invitationId: string) {
    try {
      await authClient.organization.rejectInvitation({ invitationId });
      await loadUserInvitations();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateFirstOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!firstOrgName.trim() || !firstOrgSlug.trim()) return;
    setCreatingFirstOrg(true);
    setFirstOrgError(null);
    try {
      const cleanSlug = slugify(firstOrgSlug);
      const res = await authClient.organization.create({
        name: firstOrgName.trim(),
        slug: cleanSlug,
      });
      if (res?.error) {
        setFirstOrgError(res.error.message || t("requestFailed"));
        setCreatingFirstOrg(false);
        return;
      }
      void queryClient.invalidateQueries();
      window.location.href = buildHref("/apps", { orgSlug: cleanSlug });
    } catch (err) {
      setFirstOrgError(err instanceof Error ? err.message : t("requestFailed"));
      setCreatingFirstOrg(false);
    }
  }

  if (sessionPending || loadingOrgs || loadingInvites) {
    return (
      <div className="text-sm text-kumo-subtle flex items-center justify-center p-12">
        {t("loading")}...
      </div>
    );
  }

  return (
    <main className="w-full max-w-xl mx-auto py-8">
      <Surface className="p-6 sm:p-8 rounded-2xl border border-kumo-line bg-kumo-canvas shadow-sm grid gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Text variant="heading" as="h1" size="lg">
              {orgList.length === 0 ? t("noOrgsYet") : t("selectOrganization")}
            </Text>
            <p className="mt-1 text-sm text-kumo-subtle">
              {orgList.length === 0 ? t("createFirstOrgDescription") : t("selectOrgDescription")}
            </p>
          </div>
          {orgList.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => router.push("/organization/new")}>
              <Plus size={16} />
              {t("createNewOrg")}
            </Button>
          )}
        </div>

        {/* Pending Invitations Banner */}
        {userInvitations.length > 0 && (
          <div className="rounded-xl border border-kumo-line bg-kumo-base p-4 grid gap-3">
            <div className="font-semibold text-sm">{t("userInvitations")}</div>
            {userInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-kumo-line bg-kumo-canvas p-3 text-sm"
              >
                <div>
                  <span className="font-medium">{inv.organizationName || inv.organizationId}</span>
                  <span className="ml-2 text-kumo-subtle">({inv.role})</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => void handleAcceptInvite(inv.id)}
                  >
                    {t("acceptInvitation")}
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => void handleRejectInvite(inv.id)}
                  >
                    {t("cancelInvitation")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Organization Creation / Selection List */}
        {orgList.length === 0 ? (
          <div className="rounded-xl border border-kumo-line bg-kumo-base p-5 grid gap-4">
            {firstOrgError && (
              <div className="rounded-lg border border-kumo-danger/20 bg-kumo-danger/10 p-3 text-xs text-kumo-danger font-medium">
                {firstOrgError}
              </div>
            )}
            <form onSubmit={handleCreateFirstOrg} className="grid gap-4">
              <Input
                label={t("orgName")}
                placeholder="e.g. Acme Corp"
                value={firstOrgName}
                onChange={(e) => {
                  setFirstOrgName(e.target.value);
                  if (!firstOrgSlug) setFirstOrgSlug(slugify(e.target.value));
                }}
                required
              />
              <Input
                label={t("orgSlug")}
                placeholder="e.g. acme-corp"
                value={firstOrgSlug}
                onChange={(e) => setFirstOrgSlug(slugify(e.target.value))}
                required
              />
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={creatingFirstOrg}
                  disabled={!firstOrgName.trim() || !firstOrgSlug.trim()}
                  className="w-full"
                >
                  <Plus size={16} />
                  {t("createOrganization")}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="grid gap-3">
            {orgList.map((org) => {
              const isActive = org.id === activeOrg?.id;
              return (
                <div
                  key={org.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-kumo-line bg-kumo-base p-4 hover:border-kumo-brand transition-colors"
                >
                  <div className="grid gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{org.name}</span>
                      {isActive && <Badge variant="green">{t("activeOrg")}</Badge>}
                    </div>
                    <span className="font-mono text-xs text-kumo-subtle">{org.slug}</span>
                  </div>
                  <Button
                    variant={isActive ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => void handleEnter(org)}
                  >
                    {t("enterOrg")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer: User Info & Sign Out */}
        {session?.user && (
          <div className="flex items-center justify-between pt-4 border-t border-kumo-line text-xs text-kumo-subtle">
            <span>
              Signed in as{" "}
              <span className="font-medium text-kumo-default">
                {session.user.name || session.user.email}
              </span>
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
              className="text-kumo-subtle hover:text-kumo-danger hover:underline cursor-pointer"
            >
              {t("signOut")}
            </button>
          </div>
        )}
      </Surface>
    </main>
  );
}
