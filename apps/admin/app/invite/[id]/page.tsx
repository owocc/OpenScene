"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Text } from "@cloudflare/kumo/components/text";
import { Badge } from "@cloudflare/kumo/components/badge";
import { authClient, useSession } from "../../../lib/auth-client";
import { useI18n } from "../../ui/i18n";
import { buildHref } from "../../ui/navigation";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, isPending: sessionPending } = useSession();

  const invitationId = typeof params?.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<{
    id: string;
    email: string;
    role: string;
    status: string;
    organizationName?: string;
    organizationSlug?: string;
    organizationId?: string;
    inviterEmail?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!invitationId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/auth/organization/get-invitation?id=${encodeURIComponent(invitationId)}`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setError(t("invitationExpiredOrInvalid"));
          setLoading(false);
          return;
        }
        const data = await res.json();
        setInvitation(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(t("invitationExpiredOrInvalid"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [invitationId, t]);

  async function handleAccept() {
    if (!invitationId) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await authClient.organization.acceptInvitation({ invitationId });
      if (res?.error) {
        setError(res.error.message || t("requestFailed"));
        setAccepting(false);
        return;
      }
      const orgSlug = invitation?.organizationSlug || "default";
      if (invitation?.organizationId) {
        await authClient.organization.setActive({ organizationId: invitation.organizationId });
      }
      window.location.href = buildHref("/apps", { orgSlug });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!invitationId) return;
    setDeclining(true);
    try {
      await authClient.organization.rejectInvitation({ invitationId });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setDeclining(false);
    }
  }

  const isAuthenticated = Boolean(session?.user);

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Surface className="w-full max-w-md p-6">
        <div className="grid gap-2 text-center mb-6">
          <Text variant="heading" as="h1" size="lg">
            {t("inviteToJoinOrg")}
          </Text>
          <Text variant="secondary">
            {invitation?.organizationName
              ? `You've been invited to join ${invitation.organizationName}`
              : t("selectOrgDescription")}
          </Text>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-kumo-subtle">{t("loading")}...</div>
        ) : error ? (
          <div className="grid gap-4">
            <div className="rounded-md border border-kumo-danger/20 bg-kumo-danger/10 p-4 text-center text-sm text-kumo-danger">
              {error}
            </div>
            <div className="flex justify-center">
              <Button onClick={() => router.push("/")}>{t("continue")}</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Invitation Details Card */}
            <div className="rounded-lg border border-kumo-line bg-kumo-base p-4 grid gap-3">
              {invitation?.organizationName && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-kumo-subtle">{t("organization")}</span>
                  <span className="font-semibold">{invitation.organizationName}</span>
                </div>
              )}
              {invitation?.role && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-kumo-subtle">{t("role")}</span>
                  <Badge variant="blue">{invitation.role}</Badge>
                </div>
              )}
              {invitation?.email && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-kumo-subtle">{t("email")}</span>
                  <span className="font-mono text-xs">{invitation.email}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {sessionPending ? (
              <div className="text-center text-sm text-kumo-subtle">{t("loading")}...</div>
            ) : isAuthenticated ? (
              <div className="grid gap-2">
                <Button
                  variant="primary"
                  loading={accepting}
                  onClick={handleAccept}
                  className="w-full"
                >
                  {t("acceptAndEnter")}
                </Button>
                <Button
                  variant="secondary"
                  loading={declining}
                  onClick={handleDecline}
                  className="w-full"
                >
                  {t("decline")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                <p className="text-xs text-center text-kumo-subtle">
                  {t("invitationForEmail")}:{" "}
                  <span className="font-medium">{invitation?.email}</span>
                </p>
                <Button
                  variant="primary"
                  onClick={() =>
                    router.push(`/login?next=/invite/${encodeURIComponent(invitationId)}`)
                  }
                  className="w-full"
                >
                  {t("signInToAccept")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Surface>
    </main>
  );
}
