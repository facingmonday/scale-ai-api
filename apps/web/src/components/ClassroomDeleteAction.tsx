import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import classroomService from "@/services/classroom";
import { useAuth } from "@/context/AuthContext";

type Props = {
  classroomId: string;
  classroomName?: string;
  disabled?: boolean;
};

const ClassroomDeleteAction: React.FC<Props> = ({
  classroomId,
  classroomName,
  disabled = false,
}) => {
  const navigate = useNavigate();
  const { refetchMe } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await classroomService.remove(classroomId);
      setIsOpen(false);
      // Refetch auth to clear active classroom if it was the deleted one
      await refetchMe();
      navigate("/classrooms");
    } catch (e) {
      console.error("Failed to delete classroom:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(errorMessage || "Failed to delete classroom. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="danger-zone-row">
        <div>
          <h3 className="font-semibold mb-1">Delete Classroom</h3>
          <p className="text-text-muted text-sm">
            Permanently delete this classroom. This may remove access for all
            students and delete associated data.
          </p>
        </div>
        <Button
          label="Delete Classroom"
          icon="pi pi-trash"
          onClick={() => setIsOpen(true)}
          severity="danger"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Delete Classroom"
        visible={isOpen}
        onHide={() => !isDeleting && setIsOpen(false)}
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
              onClick={() => setIsOpen(false)}
              text
              disabled={isDeleting}
            />
            <Button
              label="Delete Classroom"
              icon="pi pi-check"
              onClick={handleDelete}
              severity="danger"
              loading={isDeleting}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-danger font-medium">{error}</p> : null}
          <p className="text-text-muted">
            Are you sure you want to permanently delete{" "}
            <strong>{classroomName || "this classroom"}</strong>?
          </p>
          <p className="text-danger font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </>
  );
};

export default ClassroomDeleteAction;
