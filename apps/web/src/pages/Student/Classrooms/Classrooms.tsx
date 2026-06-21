import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import ClassroomCard from "../../../components/ClassroomCard";
import type { ClassroomWithVirtuals } from "../../../types/classroom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import enrollmentService from "../../../services/enrollment";
import classroomService from "../../../services/classroom";
import licensingService from "../../../services/licensing";
import LoadingOverlay from "../../../components/LoadingOverlay";
import {
  canSelfJoinFromClassList,
  getClassListJoinHint,
} from "../../../utils/classroomJoin";

const Classrooms = () => {
  const { setNewActiveClassroom, activeClassroom, isLoading, organization } =
    useAuth();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();
  const [classrooms, setClassrooms] = useState<ClassroomWithVirtuals[]>([]);
  const [orgClassrooms, setOrgClassrooms] = useState<ClassroomWithVirtuals[]>(
    []
  );
  const [enrolledClassroomIds, setEnrolledClassroomIds] = useState<Set<string>>(
    new Set()
  );
  const [isFetchingClassrooms, setIsFetchingClassrooms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoiningModal, setShowJoiningModal] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joiningClassroomId, setJoiningClassroomId] = useState<string | null>(
    null
  );
  const [checkoutClassroomId, setCheckoutClassroomId] = useState<string | null>(
    null
  );
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  // Redirect if user already has an active classroom
  useEffect(() => {
    if (!isLoading && activeClassroom) {
      navigate("/", { replace: true });
    }
  }, [activeClassroom, isLoading, navigate]);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    setIsFetchingClassrooms(true);
    setError(null);
    try {
      // Fetch user's enrolled classrooms
      const myClassesData = await enrollmentService.getMyClasses();
      const enrolledClassrooms = myClassesData.data;
      setClassrooms(enrolledClassrooms);

      // Fetch all organization classrooms
      const orgClassroomsData = await classroomService.getAll();
      const allOrgClassrooms = orgClassroomsData.data || orgClassroomsData;

      const enrolledIds = enrolledClassrooms.map(
        (c: ClassroomWithVirtuals) =>
          c._id || (c as ClassroomWithVirtuals & { id?: string }).id
      );
      setEnrolledClassroomIds(new Set(enrolledIds.filter(Boolean) as string[]));

      // Show all org classrooms; we'll display an "Enrolled" badge for ones
      // already in the user's classes.
      setOrgClassrooms(allOrgClassrooms);
    } catch (err) {
      console.error("Failed to fetch classrooms:", err);
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(errorMessage || "Failed to load classrooms");
    } finally {
      setIsFetchingClassrooms(false);
    }
  };

  const handleJoiningClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    setIsJoining(false);
    return;
  };

  const handleJoinClassroom = async (classroom: ClassroomWithVirtuals) => {
    const classroomId =
      classroom._id ||
      (classroom as ClassroomWithVirtuals & { id?: string }).id;
    if (!classroomId) return;

    setJoiningClassroomId(classroomId);
    try {
      globalContext?.setIsLoading(true);

      // Join the classroom (enrolls as member)
      await enrollmentService.joinClass(classroomId);

      // Set as active classroom
      await setNewActiveClassroom(classroom);

      globalContext?.setIsLoading(false);
      // Will automatically navigate to dashboard
    } catch (err) {
      console.error("Failed to join classroom:", err);
      const response =
        err && typeof err === "object" && "response" in err
          ? (err as {
              response?: {
                data?: { message?: string; error?: string; code?: string };
              };
            }).response
          : undefined;
      const errorCode = response?.data?.code;
      const errorMessage =
        response?.data?.error ||
        response?.data?.message ||
        "Failed to join classroom. Please try again.";

      if (errorCode === "PAYMENT_REQUIRED" && classroomId) {
        setCheckoutClassroomId(classroomId);
        setError(errorMessage);
      } else {
        setError(errorMessage);
      }
      globalContext?.setIsLoading(false);
      setJoiningClassroomId(null);
    }
  };

  const startCheckout = async () => {
    if (!checkoutClassroomId || isStartingCheckout) return;
    setIsStartingCheckout(true);
    try {
      const checkout = await licensingService.createStudentCheckout(
        checkoutClassroomId
      );
      window.location.href = checkout.checkoutUrl;
    } catch (checkoutErr) {
      console.error("Unable to start checkout:", checkoutErr);
      const message =
        checkoutErr &&
        typeof checkoutErr === "object" &&
        "response" in checkoutErr
          ? (checkoutErr as { response?: { data?: { error?: string } } })
              .response?.data?.error
          : undefined;
      setError(message || "Checkout is not available yet.");
      setIsStartingCheckout(false);
    }
  };

  if (error && classrooms.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <div className="card text-center">
            <p className="text-text-muted mb-4">{error}</p>
            <button onClick={fetchClassrooms} className="btn-teal">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BasicLayout>
      <LoadingOverlay loading={isFetchingClassrooms} />
      <div className="page">
        <div className="container">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-xl">My Classes ({classrooms.length})</h1>
          </div>

          {error && (
            <div className="card mb-6 border border-red-500/30 bg-red-500/5">
              <p className="text-red-400 text-sm">{error}</p>
              {checkoutClassroomId && (
                <button
                  className="btn-teal mt-4"
                  disabled={isStartingCheckout}
                  onClick={() => void startCheckout()}
                >
                  {isStartingCheckout
                    ? "Starting checkout..."
                    : "Buy Class Access"}
                </button>
              )}
            </div>
          )}

          {/* Organization Classrooms Section */}
          {orgClassrooms.length > 0 ? (
            <div className="mt-12">
              <h2 className="heading-xl mb-6">
                {organization?.name || "Organization"}'s Class List
              </h2>
              <div className="classroom-card-grid">
                {orgClassrooms.map((classroom) => {
                  const classroomId =
                    classroom._id ||
                    (classroom as ClassroomWithVirtuals & { id?: string }).id;
                  const isEnrolled = Boolean(
                    classroomId && enrolledClassroomIds.has(classroomId)
                  );
                  const showJoinButton =
                    isEnrolled || canSelfJoinFromClassList(classroom);
                  const joinHint = getClassListJoinHint(classroom, isEnrolled);
                  return (
                    <ClassroomCard
                      key={classroomId}
                      classroom={classroom}
                      showJoinButton={showJoinButton}
                      joinHint={joinHint}
                      isEnrolled={isEnrolled}
                      onJoinClick={() => handleJoinClassroom(classroom)}
                      isJoining={joiningClassroomId === classroomId}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card text-center">
              <p className="text-text-muted mb-4">No classrooms found</p>
            </div>
          )}

          {/* Create Classroom Modal */}
          {showJoiningModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="card max-w-md w-full">
                <h2 className="heading-lg mb-4">Join a Class</h2>
                <form onSubmit={handleJoiningClass}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="label">
                        Class Code *
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={classCode}
                        onChange={(e) => setClassCode(e.target.value)}
                        className="input"
                        placeholder="Enter classroom name"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowJoiningModal(false);
                        setClassCode("");
                      }}
                      className="btn-outline flex-1"
                      disabled={isJoining}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-teal flex-1"
                      disabled={isJoining || !classCode.trim()}
                    >
                      {isJoining ? "Joining..." : "Join"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </BasicLayout>
  );
};

export default Classrooms;
