import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from "primereact/checkbox";
import { useGlobalContext } from "../../../context/GlobalContext";
import profileTypeService from "../../../services/profileType";
import type { ProfileType } from "../../../types/profileType";
import { useAuth } from "../../../context/AuthContext";

type Props = {
  showTitle?: boolean;
  /**
   * Where the Profile Type detail page should navigate back to.
   * This is passed via querystring to allow refresh/deep-linking.
   */
  returnTo?: string;
};

const slugifyStoreTypeKey = (label: string) => {
  return label
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
};

const ProfileTypes: React.FC<Props> = ({
  showTitle = true,
  returnTo = "/profile-types",
}) => {
  const globalContext = useGlobalContext();
  const navigate = useNavigate();
  const { activeClassroom } = useAuth();

  const classroomId = activeClassroom?._id ?? null;

  const [profileTypes, setStoreTypes] = useState<ProfileType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [storeTypeToDelete, setStoreTypeToDelete] = useState<ProfileType | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    key: "",
    label: "",
    description: "",
    isActive: true,
    startingBalance: "0",
    initialStartupCost: "0",
  });

  const fetchStoreTypes = useCallback(async () => {
    if (!classroomId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await profileTypeService.getAll("admin", { classroomId });
      const data = (response?.data ?? response ?? []) as ProfileType[];
      setStoreTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch profile types:", e);
      setError("Failed to load profile types");
    } finally {
      setIsLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    void fetchStoreTypes();
  }, [fetchStoreTypes]);

  const handleDeleteClick = (profileType: ProfileType) => {
    setStoreTypeToDelete(profileType);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!storeTypeToDelete) return;
    if (!classroomId) return;

    setIsDeleting(true);
    setError(null);
    try {
      await profileTypeService.remove(
        storeTypeToDelete._id || storeTypeToDelete.key,
        { classroomId }
      );
      globalContext?.showToast?.("Profile type deleted", "success");
      setShowDeleteDialog(false);
      setStoreTypeToDelete(null);
      void fetchStoreTypes();
    } catch (e) {
      console.error("Failed to delete profile type:", e);
      globalContext?.showToast?.("Failed to delete profile type", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateClick = () => {
    setCreateFormData({
      key: "",
      label: "",
      description: "",
      isActive: true,
      startingBalance: "0",
      initialStartupCost: "0",
    });
    setShowCreateDialog(true);
  };

  const handleCreateSubmit = async () => {
    const label = createFormData.label.trim();
    const key = slugifyStoreTypeKey(label);

    if (!label) {
      globalContext?.showToast?.("Label is required", "error");
      return;
    }
    if (!classroomId) {
      globalContext?.showToast?.("Please select a classroom first", "error");
      return;
    }
    if (!key) {
      globalContext?.showToast?.("Please enter a valid label", "error");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await profileTypeService.create(
        {
          key,
          label,
          description: createFormData.description.trim() || undefined,
          isActive: createFormData.isActive,
          startingBalance: Number(createFormData.startingBalance || 0),
          initialStartupCost: Number(createFormData.initialStartupCost || 0),
        },
        { classroomId }
      );

      const createdStoreType = response?.data || response;
      globalContext?.showToast?.("Profile type created", "success");
      setShowCreateDialog(false);
      setCreateFormData({
        key: "",
        label: "",
        description: "",
        isActive: true,
        startingBalance: "0",
        initialStartupCost: "0",
      });

      // Navigate to the detail page
      if (createdStoreType?._id) {
        navigate(
          `/profile-types/${createdStoreType._id}?returnTo=${encodeURIComponent(
            returnTo
          )}`
        );
      } else {
        void fetchStoreTypes();
      }
    } catch (e) {
      console.error("Failed to create profile type:", e);
      globalContext?.showToast?.("Failed to create profile type", "error");
    } finally {
      setIsCreating(false);
    }
  };

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => void fetchStoreTypes()} className="btn-teal">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="heading-lg">Profile Types</h2>
            <p className="text-text-muted">
              Manage profile types available for student profiles.
            </p>
          </div>
        </div>
      )}

      <DataTable
        value={profileTypes}
        dataKey="_id"
        emptyMessage="No profile types found"
        loading={isLoading}
        header={
          <div className="flex justify-end">
            <Button
              label="Create Profile Type"
              icon="pi pi-plus"
              onClick={handleCreateClick}
              className="btn-teal"
            />
          </div>
        }
      >
        <Column field="label" header="Label" sortable />
        <Column
          field="startingBalance"
          header="Starting Balance"
          body={(row: ProfileType) => String(row.startingBalance ?? 0)}
          sortable
          sortField="startingBalance"
        />
        <Column
          field="initialStartupCost"
          header="Startup Cost"
          body={(row: ProfileType) => String(row.initialStartupCost ?? 0)}
          sortable
          sortField="initialStartupCost"
        />
        <Column
          field="description"
          header="Description"
          body={(row: ProfileType) => row.description || "-"}
          sortable
          sortField="description"
        />
        <Column
          field="isActive"
          header="Active"
          body={(row: ProfileType) => (row.isActive ? "Yes" : "No")}
          sortable
          sortField="isActive"
        />
        <Column
          header="Actions"
          body={(row: ProfileType) => (
            <div className="flex justify-end gap-2">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                onClick={() =>
                  navigate(
                    `/profile-types/${row._id}?returnTo=${encodeURIComponent(
                      returnTo
                    )}`
                  )
                }
                aria-label="Edit profile type"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                onClick={() => handleDeleteClick(row)}
                aria-label="Delete profile type"
              />
            </div>
          )}
        />
      </DataTable>

      {/* Delete Profile Type Dialog */}
      <Dialog
        header="Delete Profile Type"
        visible={showDeleteDialog}
        onHide={() => !isDeleting && setShowDeleteDialog(false)}
        modal
        closable={!isDeleting}
        dismissableMask={!isDeleting}
        className="modal w-full max-w-2xl"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setShowDeleteDialog(false)}
              text
              disabled={isDeleting}
            />
            <Button
              label="Delete Profile Type"
              icon="pi pi-check"
              onClick={handleDeleteConfirm}
              severity="danger"
              loading={isDeleting}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Are you sure you want to permanently delete the profile type{" "}
            <strong>
              {storeTypeToDelete?.label ||
                storeTypeToDelete?.key ||
                "this profile type"}
            </strong>
            ? This will:
          </p>
          <ul className="list-disc list-inside text-text-muted ml-4">
            <li>Remove it from all profiles using this type</li>
            <li>Delete all associated data</li>
            <li>Permanently delete the profile type</li>
          </ul>
          <p className="text-red-400 font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>

      {/* Create Profile Type Dialog */}
      <Dialog
        header="Create Profile Type"
        visible={showCreateDialog}
        onHide={() => !isCreating && setShowCreateDialog(false)}
        modal
        closable={!isCreating}
        dismissableMask={!isCreating}
        className="modal w-full max-w-2xl"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setShowCreateDialog(false)}
              text
              disabled={isCreating}
            />
            <Button
              label="Create Profile Type"
              icon="pi pi-check"
              onClick={handleCreateSubmit}
              className="btn-teal"
              loading={isCreating}
              disabled={!createFormData.label.trim()}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="create-label" className="text-sm font-medium">
              Label <span className="text-red-400">*</span>
            </label>
            <InputText
              id="create-label"
              value={createFormData.label}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  label: e.target.value,
                  key: slugifyStoreTypeKey(e.target.value),
                })
              }
              placeholder="e.g., Food Truck"
              disabled={isCreating}
              className="w-full"
            />
            <p className="text-text-muted text-xs">
              Human-readable name for the profile type
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="create-description" className="text-sm font-medium">
              Description
            </label>
            <InputTextarea
              id="create-description"
              value={createFormData.description}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  description: e.target.value,
                })
              }
              placeholder="Optional description of the profile type"
              disabled={isCreating}
              rows={3}
              className="w-full"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="create-startingBalance"
                className="text-sm font-medium"
              >
                Starting Balance
              </label>
              <InputText
                id="create-startingBalance"
                type="number"
                min={0}
                value={createFormData.startingBalance}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    startingBalance: e.target.value,
                  })
                }
                placeholder="0"
                disabled={isCreating}
                className="w-full"
              />
              <p className="text-text-muted text-xs">
                Starting cash balance for new student profiles of this type.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="create-initialStartupCost"
                className="text-sm font-medium"
              >
                Initial Startup Cost
              </label>
              <InputText
                id="create-initialStartupCost"
                type="number"
                min={0}
                value={createFormData.initialStartupCost}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    initialStartupCost: e.target.value,
                  })
                }
                placeholder="0"
                disabled={isCreating}
                className="w-full"
              />
              <p className="text-text-muted text-xs">
                One-time cost applied when a student creates a profile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              inputId="create-isActive"
              checked={createFormData.isActive}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  isActive: e.checked ?? true,
                })
              }
              disabled={isCreating}
            />
            <label htmlFor="create-isActive" className="text-sm font-medium">
              Active
            </label>
            <p className="text-text-muted text-xs">
              Profile type will be available for selection
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default ProfileTypes;
