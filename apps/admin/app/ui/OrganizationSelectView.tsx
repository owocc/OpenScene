"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
import { Badge } from "@cloudflare/kumo/components/badge";
import { DotsThree, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  authClient,
  useActiveOrganization,
  useListOrganizations,
  useSession,
} from "@/lib/auth-client";
import { useI18n } from "./i18n";
import { buildHref } from "./navigation";
import { TableSkeleton } from "./PageSkeleton";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "org"
  );
}

export function OrganizationSelectView() {
  const router = useRouter();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const { data: orgs, isPending: loadingOrgs } = useListOrganizations();
  const { data: activeOrg } = useActiveOrganization();

  const [searchQuery, setSearchQuery] = useState("");
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

  // Create Organization Dialog state
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgSlugEdited, setNewOrgSlugEdited] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionPending && !session?.user) {
      router.replace("/login?next=/");
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

  const filteredOrgs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orgList;
    return orgList.filter(
      (org) => org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q),
    );
  }, [orgList, searchQuery]);

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

  async function handleCreateOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;
    setCreatingOrg(true);
    setCreateError(null);
    try {
      const cleanSlug = slugify(newOrgSlug);
      const res = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: cleanSlug,
      });
      if (res?.error) {
        setCreateError(res.error.message || t("requestFailed"));
        setCreatingOrg(false);
        return;
      }
      setCreateOrgOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgSlugEdited(false);
      void queryClient.invalidateQueries();
      window.location.href = buildHref("/apps", { orgSlug: cleanSlug });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t("requestFailed"));
      setCreatingOrg(false);
    }
  }

  if (sessionPending || loadingOrgs || loadingInvites) {
    return (
      <div className="w-full max-w-5xl mx-auto py-2 sm:py-4 flex flex-col gap-6">
        <div className="grid gap-1.5">
          <div className="h-4 w-40 rounded bg-kumo-line/50 animate-pulse" />
          <div className="h-8 w-48 rounded bg-kumo-line/50 animate-pulse" />
          <div className="h-4 w-72 rounded bg-kumo-line/50 animate-pulse" />
        </div>
        <TableSkeleton rows={4} columns={3} hasToolbar />
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-5xl mx-auto py-2 sm:py-4 flex min-h-[calc(100vh-8rem)] flex-col justify-between gap-10">
        <div className="grid gap-6">
          {/* User email & Title section (Cloudflare style) */}
          <div>
            {session?.user?.email && (
              <div className="text-xs font-medium text-kumo-subtle">{session.user.email}</div>
            )}
            <Text variant="heading" as="h1" size="lg">
              {t("organizations")}
            </Text>
            <p className="mt-1.5 text-sm text-kumo-subtle">
              {orgList.length === 0 ? t("createFirstOrgDescription") : t("selectOrgDescription")}
            </p>
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
                    <span className="font-medium">
                      {inv.organizationName || inv.organizationId}
                    </span>
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

          {/* Search & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[260px] max-w-xl">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-kumo-subtle">
                <MagnifyingGlass size={16} />
              </span>
              <Input
                aria-label={t("searchOrganizations")}
                placeholder={t("searchOrganizations")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="!pl-9 w-full"
              />
            </div>
            <Button variant="primary" icon={Plus} onClick={() => setCreateOrgOpen(true)}>
              {t("createNewOrg")}
            </Button>
          </div>

          {/* Organizations Table (Cloudflare style) */}
          {orgList.length === 0 ? (
            <LayerCard className="p-6 sm:p-8 rounded-xl ring ring-kumo-line grid gap-4 max-w-lg">
              <div>
                <Text variant="heading" as="h2">
                  {t("noOrgsYet")}
                </Text>
                <p className="mt-1 text-xs text-kumo-subtle">{t("createFirstOrgDescription")}</p>
              </div>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setCreateOrgOpen(true)}
                className="w-full"
              >
                {t("createOrganization")}
              </Button>
            </LayerCard>
          ) : (
            <LayerCard className="w-full overflow-x-auto p-0 shadow-sm ring ring-kumo-line rounded-xl">
              <Table layout="fixed">
                <colgroup>
                  <col />
                  <col style={{ width: "240px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "64px" }} />
                </colgroup>
                <Table.Header>
                  <Table.Row>
                    <Table.Head className="font-medium text-xs text-kumo-subtle">
                      {t("organization")} ↑
                    </Table.Head>
                    <Table.Head className="font-medium text-xs text-kumo-subtle">
                      {t("orgSlug")}
                    </Table.Head>
                    <Table.Head className="font-medium text-xs text-kumo-subtle">
                      {t("status")}
                    </Table.Head>
                    <Table.Head sticky="right" className="text-right">
                      <span className="sr-only">{t("actions")}</span>
                    </Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredOrgs.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={4} className="py-8 text-center text-sm text-kumo-subtle">
                        {t("noResults")}
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    filteredOrgs.map((org) => {
                      const isActive = org.id === activeOrg?.id;
                      return (
                        <Table.Row
                          key={org.id}
                          className="hover:bg-kumo-surface/50 transition-colors"
                        >
                          <Table.Cell>
                            <button
                              type="button"
                              onClick={() => void handleEnter(org)}
                              className="font-medium text-kumo-link hover:underline text-left cursor-pointer"
                            >
                              {org.name}
                            </button>
                          </Table.Cell>
                          <Table.Cell className="font-mono text-xs text-kumo-subtle">
                            {org.slug || "—"}
                          </Table.Cell>
                          <Table.Cell>
                            {isActive ? (
                              <Badge variant="green">{t("activeOrg")}</Badge>
                            ) : (
                              <span className="text-xs text-kumo-subtle">—</span>
                            )}
                          </Table.Cell>
                          <Table.Cell sticky="right" className="text-right">
                            <button
                              type="button"
                              onClick={() => void handleEnter(org)}
                              title={t("enterOrg")}
                              aria-label={t("enterOrg")}
                              className="inline-flex size-7 items-center justify-center rounded-md text-kumo-subtle hover:bg-kumo-fill hover:text-kumo-default transition-colors cursor-pointer"
                            >
                              <DotsThree size={18} weight="bold" />
                            </button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                </Table.Body>
              </Table>
            </LayerCard>
          )}
        </div>

        {/* Cloudflare-style Page Footer */}
        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-kumo-line pt-6 text-xs text-kumo-subtle">
          <span>Support</span>
          <span>System Status</span>
          <span>Careers</span>
          <span>Terms of Use</span>
          <span>Report Security Issues</span>
          <span>Privacy Policy</span>
          <span>© 2026 OpenScene, Inc.</span>
        </footer>
      </div>
      {/* Create Organization Modal Dialog */}
      <Dialog.Root open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("createNewOrg")}</Dialog.Title>
          <Dialog.Description>{t("createOrgDescription")}</Dialog.Description>
          {createError && (
            <div className="rounded-lg border border-kumo-danger/20 bg-kumo-danger/10 p-3 text-xs text-kumo-danger font-medium mt-3">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreateOrgSubmit} className="grid gap-4 py-4">
            <Input
              label={t("orgName")}
              placeholder="e.g. Acme Corp"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value);
                if (!newOrgSlugEdited) setNewOrgSlug(slugify(e.target.value));
              }}
              required
            />
            <Input
              label={t("orgSlug")}
              placeholder="e.g. acme-corp"
              value={newOrgSlug}
              onChange={(e) => {
                setNewOrgSlugEdited(true);
                setNewOrgSlug(slugify(e.target.value));
              }}
              required
            />
            <div className="flex justify-end gap-2 pt-3 border-t border-kumo-line">
              <Dialog.Close render={<Button type="button">{t("cancel")}</Button>} />
              <Button
                type="submit"
                variant="primary"
                loading={creatingOrg}
                disabled={!newOrgName.trim() || !newOrgSlug.trim()}
              >
                {t("createOrganization")}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </>
  );
}
