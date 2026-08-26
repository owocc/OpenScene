"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useQueryClient } from "@tanstack/react-query";
import { authClient, useSession } from "@/lib/auth-client";
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

export default function StandaloneOrganizationNewPage() {
  const router = useRouter();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionPending && !session?.user) {
      router.replace("/login?next=/organization/new");
    }
  }, [session, sessionPending, router]);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(slugify(val));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const cleanSlug = slugify(slug);
      const res = await authClient.organization.create({
        name: name.trim(),
        slug: cleanSlug,
      });
      if (res?.error) {
        setError(res.error.message || t("requestFailed"));
        setLoading(false);
        return;
      }
      void queryClient.invalidateQueries();
      window.location.href = buildHref("/apps", { orgSlug: cleanSlug });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto py-4">
      <LayerCard className="p-6 sm:p-8 rounded-xl shadow-sm ring ring-kumo-line">
        <div className="mb-6">
          <Text variant="heading" as="h1" size="lg">
            {t("createNewOrg")}
          </Text>
          <p className="mt-1 text-sm text-kumo-subtle">{t("createOrgDescription")}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-kumo-danger/20 bg-kumo-danger/10 p-3 text-sm text-kumo-danger font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-5">
          <Input
            label={t("orgName")}
            placeholder="e.g. Acme Corp"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />

          <Input
            label={t("orgSlug")}
            placeholder="e.g. acme-corp"
            value={slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              setSlug(e.target.value);
            }}
            required
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-kumo-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/organization/select")}
              disabled={loading}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!name.trim() || !slug.trim()}
            >
              {t("createOrganization")}
            </Button>
          </div>
        </form>
      </LayerCard>
    </div>
  );
}
