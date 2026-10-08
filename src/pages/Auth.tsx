import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Wordmark } from "@/components/Wordmark";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-16 items-center border-b border-border px-5 sm:px-8">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Workspace access</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Sign in to GymNetic
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            One account per workspace, for gym owners and their front desk.
            Member accounts are issued by the gym itself.
          </p>

          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            {step === "signIn" ? (
              <form onSubmit={handleEmailSubmit}>
                <label htmlFor="email" className="eyebrow">
                  Work email
                </label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    placeholder="you@gym.com"
                    type="email"
                    className="pl-9 shadow-none"
                    disabled={isLoading}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="mt-4 w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Send code
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                {error && (
                  <p className="mt-3 text-sm text-rose-300">{error}</p>
                )}

                <div className="my-6 h-px w-full bg-border" />

                <Button
                  type="button"
                  variant="outline"
                  className="w-full shadow-none"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  <UserX className="size-4" />
                  Continue as guest
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Guest access opens a throwaway workspace with the sample
                  catalog, schedule and roster already in place.
                </p>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit}>
                <p className="eyebrow">Verification</p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">
                  Check your email
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a six-digit code to {step.email}
                </p>

                <input type="hidden" name="email" value={step.email} />
                <input type="hidden" name="code" value={otp} />

                <div className="mt-6 flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                    disabled={isLoading}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        otp.length === 6 &&
                        !isLoading
                      ) {
                        const form = (event.target as HTMLElement).closest(
                          "form",
                        );
                        if (form) form.requestSubmit();
                      }
                    }}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <p className="mt-3 text-center text-sm text-rose-300">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="mt-6 w-full"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify code
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => setStep("signIn")}
                  disabled={isLoading}
                >
                  Use a different email
                </Button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
            New here? This form creates your workspace — the same email signs
            you in from then on, and you land on the overview.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
