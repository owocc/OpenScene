"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Text } from "@cloudflare/kumo/components/text";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { fetchClient, isApiProblem } from "../ui/api";
import { useAdminContext, useI18n } from "../ui/i18n";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { href } = useAdminContext();
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchClient.GET("/api/v1/auth/session").then(({ data }) => {
      if (data?.authenticated) router.replace(params.get("next") || href("/apps"));
    });
  }, [href, params, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await fetchClient.POST("/api/v1/auth/session", { body: { token } });
    setLoading(false);
    if (result.error) {
      setError(isApiProblem(result.error) ? result.error.detail : t("requestFailed"));
      return;
    }
    router.replace(params.get("next") || href("/apps"));
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Surface className="w-full max-w-md p-6">
        <Text variant="heading" as="h1" size="lg">
          OpenScene Admin
        </Text>
        <Text variant="secondary" DANGEROUS_className="mt-2">
          {t("signIn")}
        </Text>
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <Input
            label={t("managementToken")}
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            error={error || undefined}
            required
          />
          <Button type="submit" variant="primary" loading={loading} disabled={!token}>
            {t("continue")}
          </Button>
        </form>
      </Surface>
    </main>
  );
}
