"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Text } from "@cloudflare/kumo/components/text";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { fetchClient, isApiProblem } from "../ui/api";
import { useI18n } from "../ui/i18n";

type AuthMode = "signin" | "signup" | "token";

export default function LoginPage() {
  const params = useSearchParams();
  const { t } = useI18n();
  const { data: session, isPending } = useSession();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const destination = params.get("next") || "/";

  useEffect(() => {
    if (!isPending && session?.user) {
      window.location.href = destination;
    }
  }, [session, isPending, destination]);

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await signIn.email({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || t("requestFailed"));
        setLoading(false);
        return;
      }

      window.location.href = destination;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setLoading(false);
    }
  }

  async function handleEmailSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signUpError } = await signUp.email({
        name,
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || t("requestFailed"));
        setLoading(false);
        return;
      }

      window.location.href = destination;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setLoading(false);
    }
  }

  async function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await fetchClient.POST("/api/v1/auth/session", { body: { token } });
      if (result.error) {
        setError(isApiProblem(result.error) ? result.error.detail : t("requestFailed"));
        setLoading(false);
        return;
      }
      window.location.href = destination;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setLoading(false);
    }
  }

  async function handleSocialSignIn(provider: "github" | "google") {
    setError("");
    setLoading(true);
    try {
      const { error: socialError } = await signIn.social({
        provider,
        callbackURL: destination,
      });
      if (socialError) {
        setError(socialError.message || t("requestFailed"));
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Surface className="w-full max-w-md p-6">
        <div className="grid gap-1.5">
          <Text variant="heading" as="h1" size="lg">
            OpenScene
          </Text>
          <Text variant="secondary">
            {mode === "signin"
              ? "Sign in to your account"
              : mode === "signup"
                ? "Create a new account"
                : t("managementToken")}
          </Text>
        </div>

        <div className="mt-4 flex gap-2 border-b border-kumo-line pb-3">
          <Button
            size="sm"
            variant={mode === "signin" ? "primary" : "secondary"}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            {t("signIn")}
          </Button>
          <Button
            size="sm"
            variant={mode === "signup" ? "primary" : "secondary"}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Sign up
          </Button>
          <Button
            size="sm"
            variant={mode === "token" ? "primary" : "secondary"}
            onClick={() => {
              setMode("token");
              setError("");
            }}
          >
            Token
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-kumo-danger/20 bg-kumo-danger/10 px-3 py-2 text-sm text-kumo-danger">
            {error}
          </div>
        )}

        {mode === "signin" && (
          <form className="mt-4 grid gap-4" onSubmit={handleEmailSignIn}>
            <Input
              label="Email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!email || !password}
            >
              {t("signIn")}
            </Button>
          </form>
        )}

        {mode === "signup" && (
          <form className="mt-4 grid gap-4" onSubmit={handleEmailSignUp}>
            <Input
              label="Name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!name || !email || !password}
            >
              Create account
            </Button>
          </form>
        )}

        {mode === "token" && (
          <form className="mt-4 grid gap-4" onSubmit={handleTokenSubmit}>
            <Input
              label={t("managementToken")}
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" loading={loading} disabled={!token}>
              {t("continue")}
            </Button>
          </form>
        )}

        {mode !== "token" && (
          <div className="mt-6 border-t border-kumo-line pt-4">
            <Text variant="secondary" size="sm" DANGEROUS_className="text-center block mb-3">
              Or continue with
            </Text>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSocialSignIn("github")}
                disabled={loading}
              >
                GitHub
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSocialSignIn("google")}
                disabled={loading}
              >
                Google
              </Button>
            </div>
          </div>
        )}
      </Surface>
    </main>
  );
}
