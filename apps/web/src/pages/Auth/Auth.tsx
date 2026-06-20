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

  const { orgId, classroomId, checkoutStatus } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      orgId: params.get("orgId"),
      classroomId: params.get("classroomId"),
      checkoutStatus: params.get("checkout"),
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

    if (isCheckoutSuccess) {
      didJoinRef.current = false;
    }

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
            {joinError ? (
              <>
                <h1 className="heading-lg mb-2">Unable to join classroom</h1>
                <p className="text-text-muted mb-6">{joinError}</p>
                {joinErrorCode === "PAYMENT_REQUIRED" && (
                  <button
                    className="btn-teal"
                    disabled={isStartingCheckout}
                    onClick={() => void startCheckout()}
                  >
                    {isStartingCheckout ? "Starting checkout..." : "Buy Class Access"}
                  </button>
                )}
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
                    ? "Payment received. Joining classroom…"
                    : "Joining classroom…"}
                </h1>
                <p className="text-text-muted">Please wait.</p>
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
