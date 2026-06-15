import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import classroomService from "../../../services/classroom";
import ClassroomCard from "../../../components/ClassroomCard";
import type { ClassroomWithVirtuals } from "../../../types/classroom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import enrollmentService from "../../../services/enrollment";
import LoadingOverlay from "../../../components/LoadingOverlay";



const Classrooms = () => {
  const { setNewActiveClassroom, activeClassroom, isLoading, organization } =
    useAuth();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();
  const [classrooms, setClassrooms] = useState<ClassroomWithVirtuals[]>([]);
  const [orgClassrooms, setOrgClassrooms] = useState<ClassroomWithVirtuals[]>(
    []
  );
  const [isFetchingClassrooms, setIsFetchingClassrooms] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joiningClassroomId, setJoiningClassroomId] = useState<string | null>(
    null
  );
  const [editingClassroom, setEditingClassroom] =
    useState<ClassroomWithVirtuals | null>(null);
  const [editClassroomName, setEditClassroomName] = useState("");
  const [editClassroomDescription, setEditClassroomDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Redirect if user already has an active classroom
  useEffect(() => {
    if (!isLoading && activeClassroom) {
      navigate("/dashboard", { replace: true });
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

      // Filter out classrooms the user is already enrolled in
      const enrolledIds = enrolledClassrooms.map(
        (c: ClassroomWithVirtuals) =>
          c._id || (c as ClassroomWithVirtuals & { id?: string }).id
      );
      const availableClassrooms = allOrgClassrooms.filter(
        (c: ClassroomWithVirtuals) => {
          const classroomId =
            c._id || (c as ClassroomWithVirtuals & { id?: string }).id;
          return !enrolledIds.includes(classroomId);
        }
      );
      setOrgClassrooms(availableClassrooms);
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

  const handleClassroomClick = async (classroom: ClassroomWithVirtuals) => {
    const classroomId =
      classroom._id ||
      (classroom as ClassroomWithVirtuals & { id?: string }).id;
    if (classroomId) {
      try {
        // Show loading overlay
        globalContext?.setIsLoading(true);

        await setNewActiveClassroom(classroom);

        // Loading will automatically hide after navigation
        // But we'll set it to false just in case
        globalContext?.setIsLoading(false);
      } catch (err) {
        console.error("Failed to set active classroom:", err);
        setError("Failed to select classroom. Please try again.");
        globalContext?.setIsLoading(false);
      }
    }
  };

  const closeEditModal = () => {
    setEditingClassroom(null);
    setEditClassroomName("");
    setEditClassroomDescription("");
  };

  useEffect(() => {
    if (!editingClassroom) return;
    setEditClassroomName(editingClassroom.name || "");
    setEditClassroomDescription(editingClassroom.description || "");
  }, [editingClassroom]);

  const handleUpdateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClassroom) return;
    const classroomId =
      editingClassroom._id ||
      (editingClassroom as ClassroomWithVirtuals & { id?: string }).id;
    if (!classroomId) return;
    if (!editClassroomName.trim()) return;

    setIsUpdating(true);
    try {
      const updated = await classroomService.update(classroomId, {
        name: editClassroomName.trim(),
        description: editClassroomDescription.trim() || undefined,
      });

      // Update local list (best-effort; backend response shape may vary)
      setClassrooms((prev) =>
        prev.map((c) => {
          const id = c._id || (c as ClassroomWithVirtuals & { id?: string }).id;
          if (id !== classroomId) return c;
          return {
            ...c,
            ...(typeof updated === "object" ? updated : {}),
            name: editClassroomName.trim(),
            description: editClassroomDescription.trim() || "",
          };
        })
      );

      globalContext?.showToast?.("Classroom updated", "success");
      closeEditModal();
    } catch (err) {
      console.error("Failed to update classroom:", err);
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      globalContext?.showToast?.(
        errorMessage || "Failed to update classroom",
        "error"
      );
    } finally {
      setIsUpdating(false);
    }
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
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(errorMessage || "Failed to join classroom. Please try again.");
      globalContext?.setIsLoading(false);
      setJoiningClassroomId(null);
    }
  };

  if (error && classrooms.length === 0) {
    return (
      <BasicLayout>
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
      </BasicLayout>
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
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/classrooms/new")}
                className="btn-blue text-white"
              >
                + New Classroom
              </button>
            </div>
          </div>

          {/* Empty State */}
          {classrooms.length === 0 ? (
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">No Classrooms Yet</h2>
              <p className="text-text-muted mb-6">
                Get started by creating your first classroom
              </p>
              <button
                onClick={() => navigate("/classrooms/new")}
                className="btn-teal"
              >
                Create Classroom
              </button>
            </div>
          ) : (
            /* Classroom Grid */
            <div className="classroom-card-grid ">
              {classrooms.map((classroom) => {
                const classroomId =
                  classroom._id ||
                  (classroom as ClassroomWithVirtuals & { id?: string }).id;
                return (
                  <ClassroomCard
                    key={classroomId}
                    classroom={classroom}
                    onClick={() => handleClassroomClick(classroom)}
                  />
                );
              })}
            </div>
          )}

          {/* Organization Classrooms Section */}
          {orgClassrooms.length > 0 && (
            <div className="mt-12">
              <h2 className="heading-xl mb-6">
                {organization?.name || "Organization"}'s Class List
              </h2>
              <div className="classroom-card-grid">
                {orgClassrooms.map((classroom) => {
                  const classroomId =
                    classroom._id ||
                    (classroom as ClassroomWithVirtuals & { id?: string }).id;
                  return (
                    <ClassroomCard
                      key={classroomId}
                      classroom={classroom}
                      showJoinButton={true}
                      onJoinClick={() => handleJoinClassroom(classroom)}
                      isJoining={joiningClassroomId === classroomId}
                    />
                  );
                })}
              </div>
            </div>
          )}



          {/* Edit Classroom Modal */}
          {editingClassroom && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="card max-w-md w-full">
                <h2 className="heading-lg mb-4">Edit Classroom</h2>
                <form onSubmit={handleUpdateClassroom}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit-name" className="label">
                        Classroom Name *
                      </label>
                      <input
                        id="edit-name"
                        type="text"
                        value={editClassroomName}
                        onChange={(e) => setEditClassroomName(e.target.value)}
                        className="input"
                        placeholder="Enter classroom name"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-description" className="label">
                        Description
                      </label>
                      <textarea
                        id="edit-description"
                        value={editClassroomDescription}
                        onChange={(e) =>
                          setEditClassroomDescription(e.target.value)
                        }
                        className="input min-h-[100px] resize-none"
                        placeholder="Enter classroom description (optional)"
                      />
                    </div>
                    <div>
                      <p className="text-text-muted text-xs mt-1">
                        Starting balances and startup costs are now configured
                        on profile types.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="btn-outline flex-1"
                      disabled={isUpdating}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-teal flex-1"
                      disabled={isUpdating || !editClassroomName.trim()}
                    >
                      {isUpdating ? "Saving..." : "Save"}
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
