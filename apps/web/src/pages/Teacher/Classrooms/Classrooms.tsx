import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import classroomService from "../../../services/classroom";
import classroomTemplatesService from "../../../services/classroomTemplates";
import ClassroomCard from "../../../components/ClassroomCard";
import type { ClassroomWithVirtuals } from "../../../types/classroom";
import type { ClassroomTemplate } from "../../../types/classroomTemplate";
import type { BillingMode } from "../../../types/licensing";
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState("");
  const [newClassroomDescription, setNewClassroomDescription] = useState("");
  const [newAllowAnonymousJoin, setNewAllowAnonymousJoin] = useState(true);
  const [newClassroomBillingMode, setNewClassroomBillingMode] =
    useState<BillingMode>("student_paid");
  const [classroomTemplates, setClassroomTemplates] = useState<
    ClassroomTemplate[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassroomName.trim()) return;

    setIsCreating(true);
    try {
      globalContext?.setIsLoading(true);

      const response = await classroomService.create({
        name: newClassroomName.trim(),
        description: newClassroomDescription.trim() || undefined,
        templateId: selectedTemplateId || undefined,
        billingMode: newClassroomBillingMode,
        joinPolicy:
          newClassroomBillingMode === "roster_only"
            ? "roster_only"
            : "invite_link",
        studentPaysAllowed:
          newClassroomBillingMode === "student_paid" ||
          newClassroomBillingMode === "hybrid",
        allowAnonymousJoin: newAllowAnonymousJoin,
      });
      const newClassroom = response.data;
      // Validate the classroom was created successfully
      if (!newClassroom || !newClassroom._id) {
        throw new Error("Failed to create classroom: Invalid response");
      }

      // Set the new classroom as active (this will navigate to /dashboard)
      await setNewActiveClassroom(newClassroom);

      globalContext?.setIsLoading(false);
    } catch (err) {
      console.error("Failed to create classroom:", err);
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      globalContext?.showToast?.(
        errorMessage || "Failed to create classroom",
        "error"
      );
      globalContext?.setIsLoading(false);
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!showCreateModal) return;
    let isMounted = true;

    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const templates = await classroomTemplatesService.getAll();
        if (isMounted) {
          setClassroomTemplates(Array.isArray(templates) ? templates : []);
        }
      } catch (err) {
        console.error("Failed to fetch classroom templates:", err);
        if (isMounted) {
          setClassroomTemplates([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTemplates(false);
        }
      }
    };

    void fetchTemplates();
    // reset selection on open
    setSelectedTemplateId("");
    setNewClassroomBillingMode("student_paid");

    return () => {
      isMounted = false;
    };
  }, [showCreateModal]);

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
                onClick={() => setShowCreateModal(true)}
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
                onClick={() => setShowCreateModal(true)}
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

          {/* Create Classroom Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="card max-w-md w-full">
                <h2 className="heading-lg mb-4">Create New Classroom</h2>
                <form onSubmit={handleCreateClassroom}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="templateId" className="label">
                        Template (optional)
                      </label>
                      <select
                        id="templateId"
                        className="input"
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        disabled={isCreating || isLoadingTemplates}
                      >
                        <option value="">
                          {isLoadingTemplates
                            ? "Loading templates..."
                            : "No template"}
                        </option>
                        {classroomTemplates.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-text-muted text-xs mt-1">
                        Templates prefill default settings and variables.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="name" className="label">
                        Classroom Name *
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={newClassroomName}
                        onChange={(e) => setNewClassroomName(e.target.value)}
                        className="input"
                        placeholder="Enter classroom name"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="label">
                        Description
                      </label>
                      <textarea
                        id="description"
                        value={newClassroomDescription}
                        onChange={(e) =>
                          setNewClassroomDescription(e.target.value)
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
                    <div>
                      <label htmlFor="billingMode" className="label">
                        How should students get access?
                      </label>
                      <select
                        id="billingMode"
                        className="input"
                        value={newClassroomBillingMode}
                        onChange={(e) =>
                          setNewClassroomBillingMode(e.target.value as BillingMode)
                        }
                        disabled={isCreating}
                      >
                        <option value="student_paid">
                          Students pay individually
                        </option>
                        <option value="teacher_paid_open">
                          Teacher-paid open seats
                        </option>
                        <option value="teacher_paid_roster">
                          Teacher-paid roster seats
                        </option>
                        <option value="hybrid">
                          Teacher seats first, then student pay
                        </option>
                        <option value="roster_only">Roster only</option>
                      </select>
                      <p className="text-text-muted text-xs mt-1">
                        You can change this later from the classroom billing
                        settings.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id="newAllowAnonymousJoin"
                        type="checkbox"
                        checked={newAllowAnonymousJoin}
                        onChange={(e) => setNewAllowAnonymousJoin(e.target.checked)}
                        className="w-4 h-4 rounded border-ui-border text-brand-teal focus:ring-brand-teal"
                      />
                      <label htmlFor="newAllowAnonymousJoin" className="text-sm font-medium text-text-primary">
                        Allow anonymous students to join (anyone with the link)
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setNewClassroomName("");
                        setNewClassroomDescription("");
                        setSelectedTemplateId("");
                        setNewClassroomBillingMode("student_paid");
                        setNewAllowAnonymousJoin(true);
                      }}
                      className="btn-outline flex-1"
                      disabled={isCreating}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-teal flex-1"
                      disabled={isCreating || !newClassroomName.trim()}
                    >
                      {isCreating ? "Creating..." : "Create"}
                    </button>
                  </div>
                </form>
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
