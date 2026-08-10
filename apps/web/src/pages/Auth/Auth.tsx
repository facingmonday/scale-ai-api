import { useEffect, useMemo, useRef, useState } from "react";
import { SignInButton, SignUpButton, useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import Scale_logo from "../../assets/logos/SCALE_logo.png";
import joinService from "../../services/join";
import licensingService from "../../services/licensing";

export default function Auth() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const didJoinRef = useRef(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinErrorCode, setJoinErrorCode] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState("");
  const [isSubmittingStudentId, setIsSubmittingStudentId] = useState(false);
  const [isJoiningAfterCheckout, setIsJoiningAfterCheckout] = useState(false);

  const { orgId, classroomId, checkoutStatus, checkoutSessionId } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      orgId: params.get("orgId"),
      classroomId: params.get("classroomId"),
      checkoutStatus: params.get("checkout"),
      checkoutSessionId: params.get("session_id"),
    };
  }, [location.search]);

  const isJoinFlow = !!orgId && !!classroomId;
  const isCheckoutSuccess = checkoutStatus === "success";

  const attemptJoin = async (studentId?: string) => {
    if (!orgId || !classroomId) return;
    setJoinError(null);
    setJoinErrorCode(null);
    await joinService.join(orgId, classroomId, studentId);
    navigate(`/classrooms/${classroomId}`);
  };

  useEffect(() => {
    if (!isJoinFlow) return;
    if (!isLoaded) return;
    if (!isSignedIn) return;
    if (!orgId || !classroomId) return;

    if (isCheckoutSuccess) return;

    if (didJoinRef.current) return;
    didJoinRef.current = true;

    const run = async () => {
      if (isCheckoutSuccess) {
        setIsJoiningAfterCheckout(true);
      }
      try {
        await attemptJoin();
      } catch (e) {
        console.error("Unable to join classroom:", e);
        const response =
          e && typeof e === "object" && "response" in e
            ? (e as {
                response?: {
                  data?: { error?: string; message?: string; code?: string };
                };
              }).response
            : undefined;
        setJoinError(
          response?.data?.error ||
            response?.data?.message ||
            "Unable to join classroom"
        );
        setJoinErrorCode(response?.data?.code || null);
        didJoinRef.current = false;
      } finally {
        setIsJoiningAfterCheckout(false);
      }
    };

    void run();
  }, [
    classroomId,
    isCheckoutSuccess,
    isJoinFlow,
    isLoaded,
    isSignedIn,
    navigate,
    orgId,
  ]);

  useEffect(() => {
    if (!isJoinFlow || !isLoaded || !isSignedIn || !isCheckoutSuccess) return;

    let cancelled = false;

    const checkCheckout = async () => {
      if (cancelled) return;
      setIsJoiningAfterCheckout(true);

      try {
        const canCheckStripeSession =
          checkoutSessionId && checkoutSessionId !== "{CHECKOUT_SESSION_ID}";

        if (canCheckStripeSession) {
          const checkout = await licensingService.getStudentCheckoutStatus(
            checkoutSessionId,
          );
          if (checkout.status !== "completed" || cancelled) return;
        }

        await attemptJoin();
      } catch (error) {
        // Keep polling: this also lets a paid checkout recover if the original
        // webhook delivery was delayed or failed.
        console.warn("Waiting for checkout confirmation:", error);
      }
    };

    void checkCheckout();
    const pollTimer = window.setInterval(() => void checkCheckout(), 3000);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
    };
  }, [
    checkoutSessionId,
    isCheckoutSuccess,
    isJoinFlow,
    isLoaded,
    isSignedIn,
  ]);

  if (!isLoaded) return null;

  if (isJoinFlow && isSignedIn) {
    const handleJoinWithStudentId = async () => {
      if (!orgId || !classroomId || !studentIdInput.trim() || isSubmittingStudentId)
        return;
      setIsSubmittingStudentId(true);
      setJoinError(null);
      setJoinErrorCode(null);
      try {
        await attemptJoin(studentIdInput.trim());
      } catch (e) {
        console.error("Unable to join classroom with student ID:", e);
        const response =
          e && typeof e === "object" && "response" in e
            ? (e as {
                response?: {
                  data?: { error?: string; message?: string; code?: string };
                };
              }).response
            : undefined;
        setJoinError(
          response?.data?.error ||
            response?.data?.message ||
            "Unable to join classroom with this Student ID."
        );
        setJoinErrorCode(response?.data?.code || null);
      } finally {
        setIsSubmittingStudentId(false);
      }
    };

    const startCheckout = async () => {
      if (!classroomId || isStartingCheckout) return;
      setIsStartingCheckout(true);
      setJoinError(null);
      try {
        const checkout = await licensingService.createStudentCheckout(classroomId);
        window.location.href = checkout.checkoutUrl;
      } catch (e) {
        console.error("Unable to start checkout:", e);
        const message =
          e && typeof e === "object" && "response" in e
            ? (e as { response?: { data?: { error?: string } } }).response?.data
                ?.error
            : undefined;
        setJoinError(message || "Checkout is not available yet.");
      } finally {
        setIsStartingCheckout(false);
      }
    };

    return (
      <div className="page">
        <div className="container">
          <div className="card text-center py-8 md:py-12 px-4 md:px-6">
            {joinErrorCode === "PAYMENT_REQUIRED" ? (
              <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-brand-teal/30 bg-ui-surface text-left shadow-md">
                <div className="grid md:grid-cols-[1.15fr_0.85fr]">
                  <div className="relative overflow-hidden bg-gradient-to-br from-brand-blue via-brand-blue to-brand-blue/90 p-6 text-white sm:p-9">
                    <div
                      className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-brand-teal/20"
                      aria-hidden="true"
                    />
                    <div
                      className="absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-brand-orange/20"
                      aria-hidden="true"
                    />

                    <div className="relative">
                      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl shadow-sm ring-1 ring-white/15">
                        <span aria-hidden="true">🍕</span>
                      </div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                        Individual access required
                      </p>
                      <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                        You’re one pass away from class
                      </h1>
                      <p className="max-w-xl text-sm leading-6 text-white/80 sm:text-base">
                        This classroom requires each student to have their own
                        SCALE Individual Class Pass. Grab yours and get back to
                        building your pizza shop.
                      </p>

                      <div className="mt-7 space-y-3">
                        {[
                          "Join this classroom after checkout",
                          "Make decisions in every class challenge",
                          "Track your shop’s results and performance",
                        ].map((benefit) => (
                          <div key={benefit} className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs text-brand-blue">
                              <i className="pi pi-check" aria-hidden="true" />
                            </span>
                            <span className="text-sm font-medium text-white/90">
                              {benefit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center p-6 sm:p-9">
                    <span className="mb-3 inline-flex w-fit items-center rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-orange">
                      One-time class pass
                    </span>
                    <div className="mb-1 flex items-end gap-2">
                      <span className="text-4xl font-extrabold tracking-tight text-text-primary">
                        $24.99
                      </span>
                      <span className="pb-1 text-sm font-medium text-text-muted">
                        USD
                      </span>
                    </div>
                    <p className="mb-6 text-sm leading-6 text-text-secondary">
                      One individual pass unlocks your access to this SCALE
                      classroom.
                    </p>

                    {joinError &&
                      joinError !== "Payment is required to join this classroom." && (
                        <div
                          className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400"
                          role="alert"
                        >
                          {joinError}
                        </div>
                      )}

                    <button
                      className="btn-teal w-full py-3 text-base font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isStartingCheckout}
                      onClick={() => void startCheckout()}
                    >
                      {isStartingCheckout ? (
                        <>
                          <i className="pi pi-spin pi-spinner" aria-hidden="true" />
                          Starting secure checkout…
                        </>
                      ) : (
                        <>
                          Buy my pass — $24.99
                          <i className="pi pi-arrow-right" aria-hidden="true" />
                        </>
                      )}
                    </button>
                    <p className="mt-3 text-center text-xs text-text-muted">
                      Secure checkout powered by Stripe
                    </p>

                    <div className="mt-6 border-t border-ui-border pt-5 text-center">
                      <p className="text-xs leading-5 text-text-muted">
                        Need a refund? Please contact support and we’ll help.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : joinError ? (
              <>
                <h1 className="heading-lg mb-2">Unable to join classroom</h1>
                <p className="text-text-muted mb-6">{joinError}</p>
                {joinErrorCode === "ROSTER_ONLY" && (
                  <div className="max-w-sm mx-auto mt-4 p-4 border border-ui-border rounded-lg bg-ui-background/50">
                    <p className="text-sm text-text-muted mb-3">
                      If you were imported using your Student ID instead of your
                      email, please enter it below to claim your seat:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Student ID"
                        value={studentIdInput}
                        onChange={(e) => setStudentIdInput(e.target.value)}
                        className="input text-sm"
                        disabled={isSubmittingStudentId}
                      />
                      <button
                        className="btn-teal text-sm py-1.5"
                        disabled={!studentIdInput.trim() || isSubmittingStudentId}
                        onClick={() => void handleJoinWithStudentId()}
                      >
                        {isSubmittingStudentId ? "Joining..." : "Submit"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className="heading-lg mb-2">
                  {isJoiningAfterCheckout
                    ? "Confirming payment and joining classroom…"
                    : "Joining classroom…"}
                </h1>
                <p className="text-text-muted">
                  {isJoiningAfterCheckout
                    ? "This can take a few seconds. Please keep this page open."
                    : "Please wait."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:reverse md:flex-row h-screen w-full">
      <div className="w-full md:w-2/3 bg-cover bg-center max-h-[25vh] md:max-h-full">
        <img
          src={Scale_logo}
          alt="SCALE Logo"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="w-full md:w-1/3 md:max-w-[400px] flex flex-col items-center justify-center bg-brand-blue p-6 md:p-8 gap-6 md:gap-8 min-h-[50vh] md:min-h-0">
        <div className="flex flex-col items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 text-center">
            Welcome to SCALE
          </h1>
          <p className="text-white text-center text-sm md:text-base">
            Supply Chain Applied Learning Environment
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full max-w-sm">
          <SignInButton mode="redirect" forceRedirectUrl={window.location.href}>
            <button className="btn-teal w-full text-black">Sign In</button>
          </SignInButton>
          <SignUpButton mode="redirect" forceRedirectUrl={window.location.href}>
            <button className="btn-orange w-full text-black">Sign Up</button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}
