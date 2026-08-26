"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { fetchClient, isApiProblem } from "../ui/api";
import { useI18n } from "../ui/i18n";
type AuthMode = "signin" | "signup" | "token";
function GoogleIcon() {
  return (
    <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="size-4.5 shrink-0 fill-current" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function LoginPage() {
  const params = useSearchParams();
  const { t } = useI18n();
  const { data: session, isPending } = useSession();

  const [mode, setMode] = useState<AuthMode>("signin");
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

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
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
        if (
          signUpError.status === 422 ||
          signUpError.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
        ) {
          setError(t("userAlreadyExists"));
        } else {
          setError(signUpError.message || t("requestFailed"));
        }
        setLoading(false);
        return;
      }

      if (destination && destination !== "/") {
        window.location.href = destination;
      } else {
        window.location.href = "/organization/select";
      }
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
    <main className="min-h-dvh flex flex-col lg:flex-row bg-kumo-canvas text-kumo-default">
      {/* Left Column: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 sm:px-12 md:px-16 xl:px-24">
        <div className="w-full max-w-[420px] mx-auto">
          {/* Header Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-kumo-default">
              {mode === "signin"
                ? "Sign In"
                : mode === "signup"
                  ? "Create an Account"
                  : t("managementToken")}
            </h1>
            <p className="mt-1 text-sm text-kumo-subtle font-mono">
              {mode === "signin"
                ? "Continue to access your dashboard"
                : mode === "signup"
                  ? "Enter your details to create your account"
                  : "Enter management token to continue"}
            </p>
          </div>

          {/* Social Auth Buttons */}
          {mode !== "token" && (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => handleSocialSignIn("google")}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-full border border-kumo-line bg-kumo-base hover:bg-kumo-hover text-sm font-medium text-kumo-default transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialSignIn("github")}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-full border border-kumo-line bg-kumo-base hover:bg-kumo-hover text-sm font-medium text-kumo-default transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <GithubIcon />
                <span>Continue with GitHub</span>
              </button>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-kumo-line" />
                </div>
                <div className="relative bg-kumo-canvas px-3 text-xs font-mono uppercase text-kumo-subtle">
                  OR
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 rounded-xl border border-kumo-danger/20 bg-kumo-danger/10 p-3 text-xs text-kumo-danger font-medium">
              {error}
            </div>
          )}

          {/* Sign In Form */}
          {mode === "signin" && (
            <form className="grid gap-4" onSubmit={handleEmailSignIn}>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-kumo-secondary">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-kumo-line bg-kumo-base px-4 py-2.5 text-sm text-kumo-default placeholder:text-kumo-placeholder focus:border-kumo-brand focus:outline-none focus:ring-1 focus:ring-kumo-brand transition"
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-kumo-secondary">
                    Password
                  </label>
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-kumo-line bg-kumo-base px-4 py-2.5 text-sm text-kumo-default placeholder:text-kumo-placeholder focus:border-kumo-brand focus:outline-none focus:ring-1 focus:ring-kumo-brand transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="mt-2 w-full rounded-full bg-black py-3 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? `${t("loading")}...` : "Sign In"}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === "signup" && (
            <form className="grid gap-4" onSubmit={handleSignUp}>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-kumo-secondary">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-kumo-line bg-kumo-base px-4 py-2.5 text-sm text-kumo-default placeholder:text-kumo-placeholder focus:border-kumo-brand focus:outline-none focus:ring-1 focus:ring-kumo-brand transition"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-kumo-secondary">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-kumo-line bg-kumo-base px-4 py-2.5 text-sm text-kumo-default placeholder:text-kumo-placeholder focus:border-kumo-brand focus:outline-none focus:ring-1 focus:ring-kumo-brand transition"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-kumo-secondary">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Create a password (min 8 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-kumo-line bg-kumo-base px-4 py-2.5 text-sm text-kumo-default placeholder:text-kumo-placeholder focus:border-kumo-brand focus:outline-none focus:ring-1 focus:ring-kumo-brand transition"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-kumo-secondary">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-kumo-line bg-kumo-base px-4 py-2.5 text-sm text-kumo-default placeholder:text-kumo-placeholder focus:border-kumo-brand focus:outline-none focus:ring-1 focus:ring-kumo-brand transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email || !password || !confirmPassword}
                className="mt-2 w-full rounded-full bg-black py-3 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? `${t("loading")}...` : "Create an Account"}
              </button>
            </form>
          )}

          {/* Token Mode Form */}
          {mode === "token" && (
            <form className="mt-2 grid gap-4" onSubmit={handleTokenSubmit}>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-kumo-secondary">
                  {t("managementToken")}
                </label>
                <input
                  type="password"
                  placeholder="Enter token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  className="w-full rounded-xl border border-kumo-line bg-kumo-base px-4 py-2.5 text-sm text-kumo-default placeholder:text-kumo-placeholder focus:border-kumo-brand focus:outline-none focus:ring-1 focus:ring-kumo-brand transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !token}
                className="mt-2 w-full rounded-full bg-black py-3 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? `${t("loading")}...` : t("continue")}
              </button>
            </form>
          )}

          {/* Footer toggle */}
          <div className="mt-8 text-center text-xs text-kumo-subtle flex flex-col gap-2.5">
            {mode === "signin" ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                  className="font-semibold text-kumo-default underline underline-offset-4 hover:opacity-80 cursor-pointer"
                >
                  Create an Account
                </button>
              </p>
            ) : mode === "signup" ? (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className="font-semibold text-kumo-default underline underline-offset-4 hover:opacity-80 cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            ) : null}

            <div>
              {mode !== "token" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("token");
                    setError("");
                  }}
                  className="text-kumo-subtle hover:text-kumo-default hover:underline cursor-pointer"
                >
                  {t("managementToken")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className="text-kumo-subtle hover:text-kumo-default hover:underline cursor-pointer"
                >
                  ← Back to email sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Clean Whitespace Area */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-kumo-base/30 border-l border-kumo-line/40 items-center justify-center p-12 overflow-hidden" />
    </main>
  );
}
