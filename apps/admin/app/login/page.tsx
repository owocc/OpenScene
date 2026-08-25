"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Text } from "@cloudflare/kumo/components/text";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { fetchClient, isApiProblem } from "../ui/api";
import { useI18n } from "../ui/i18n";

type AuthMode = "setup" | "signin" | "token";

export default function LoginPage() {
  const params = useSearchParams();
  const { t } = useI18n();
  const { data: session, isPending } = useSession();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [isSetupChecked, setIsSetupChecked] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const destination = params.get("next") || "/";

  useEffect(() => {
    if (!isPending && session?.user) {
      window.location.href = destination;
    }
  }, [session, isPending, destination]);

  // Check if system is initialized (first-time setup detection)
  useEffect(() => {
    let active = true;
    fetch("/api/v1/auth/setup-status")
      .then((res) => res.json())
      .then((data: { initialized?: boolean; hasUsers?: boolean }) => {
        if (!active) return;
        setIsSetupChecked(true);
        if (data && data.initialized === false) {
          setIsFirstTimeSetup(true);
          setMode("setup");
        } else {
          setIsFirstTimeSetup(false);
          setMode("signin");
        }
      })
      .catch(() => {
        if (!active) return;
        setIsSetupChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleInitialSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordsDoNotMatch"));
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await signUp.email({
        name: name.trim() || "Administrator",
        email: email.trim(),
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

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await signIn.email({
        email: email.trim(),
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
            {mode === "setup" ? t("setupTitle") : "OpenScene"}
          </Text>
          <Text variant="secondary">
            {mode === "setup"
              ? t("setupDescription")
              : mode === "signin"
                ? "Sign in to your administrator account"
                : t("managementToken")}
          </Text>
        </div>

        {/* Tab switcher only when system is already initialized */}
        {!isFirstTimeSetup && isSetupChecked && (
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
              variant={mode === "token" ? "primary" : "secondary"}
              onClick={() => {
                setMode("token");
                setError("");
              }}
            >
              Token
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-kumo-danger/20 bg-kumo-danger/10 px-3 py-2 text-sm text-kumo-danger">
            {error}
          </div>
        )}

        {/* Initial First-time Setup Form */}
        {mode === "setup" && (
          <form className="mt-4 grid gap-4" onSubmit={handleInitialSetup}>
            <Input
              label="Name"
              type="text"
              placeholder="Administrator (or your name)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="admin@yourdomain.com"
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
            <Input
              label={t("confirmPassword")}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!email || !password || !confirmPassword}
            >
              {t("createAdminAccount")}
            </Button>
          </form>
        )}

        {/* Regular Sign In Form */}
        {mode === "signin" && (
          <form className="mt-4 grid gap-4" onSubmit={handleEmailSignIn}>
            <Input
              label="Email"
              type="email"
              placeholder="admin@yourdomain.com"
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

        {/* Token Sign In Form */}
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

        {/* Social auth only when in regular signin */}
        {mode === "signin" && (
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
