import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import classroomService from "@/services/classroom";
import enrollmentService from "@/services/enrollment";
import type { ClassroomWithVirtuals } from "@/types/classroom";
import type { StudentDisplay } from "@/types/components";

interface ClassroomStudentTransferDialogProps {
  visible: boolean;
  onHide: () => void;
  fromClassroomId: string;
  student: StudentDisplay | null;
  onSuccess?: () => void;
}

const ClassroomStudentTransferDialog: React.FC<
  ClassroomStudentTransferDialogProps
> = ({ visible, onHide, fromClassroomId, student, onSuccess }) => {
  const [classrooms, setClassrooms] = useState<ClassroomWithVirtuals[]>([]);
  const [targetClassroomId, setTargetClassroomId] = useState<string | null>(
    null
  );
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTargetClassroomId(null);
      setError(null);
      return;
    }

    let mounted = true;
    const loadClassrooms = async () => {
      setIsLoadingClassrooms(true);
      setError(null);
      try {
        const res = await classroomService.getAll();
        const list = (res?.data ?? res ?? []) as ClassroomWithVirtuals[];
        if (!mounted) return;
        setClassrooms(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error("Failed to load classrooms:", e);
        if (!mounted) return;
        setError("Failed to load classrooms.");
      } finally {
        if (mounted) setIsLoadingClassrooms(false);
      }
    };

    void loadClassrooms();
    return () => {
      mounted = false;
    };
  }, [visible]);

  const targetOptions = useMemo(
    () =>
      classrooms
        .filter((classroom) => {
          const id =
            classroom._id ||
            (classroom as ClassroomWithVirtuals & { id?: string }).id;
          return id && id !== fromClassroomId && classroom.isActive !== false;
        })
        .map((classroom) => {
          const id =
            classroom._id ||
            (classroom as ClassroomWithVirtuals & { id?: string }).id ||
            "";
          return {
            label: classroom.name || "Untitled classroom",
            value: id,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [classrooms, fromClassroomId]
  );

  const handleTransfer = async () => {
    const userId = student?.userId || student?.id;
    if (!userId || !targetClassroomId || isTransferring) return;

    setIsTransferring(true);
    setError(null);
    try {
      await enrollmentService.transferStudent({
        userId,
        fromClassroomId,
        toClassroomId: targetClassroomId,
      });
      onSuccess?.();
      onHide();
    } catch (e) {
      console.error("Failed to transfer student:", e);
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(message || "Failed to transfer student.");
    } finally {
      setIsTransferring(false);
    }
  };

  const studentLabel =
    student?.name?.trim() || student?.email?.trim() || "this student";

  return (
    <Dialog
      header="Transfer Student"
      visible={visible}
      onHide={() => !isTransferring && onHide()}
      modal
      closable={!isTransferring}
      dismissableMask={!isTransferring}
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
            onClick={onHide}
            text
            disabled={isTransferring}
          />
          <Button
            label="Transfer student"
            icon="pi pi-arrow-right-arrow-left"
            onClick={() => void handleTransfer()}
            loading={isTransferring}
            disabled={
              !targetClassroomId ||
              isLoadingClassrooms ||
              targetOptions.length === 0
            }
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <p className="text-danger font-medium">{error}</p> : null}
        <p className="text-text-muted">
          Move <strong>{studentLabel}</strong> to another classroom in your
          organization. Their organization seat will move with them — no
          additional seat is consumed.
        </p>
        <div>
          <label className="label" htmlFor="transfer-target-classroom">
            Target classroom
          </label>
          {isLoadingClassrooms ? (
            <p className="text-text-muted text-sm">Loading classrooms…</p>
          ) : targetOptions.length === 0 ? (
            <p className="text-text-muted text-sm">
              No other active classrooms are available for transfer.
            </p>
          ) : (
            <Dropdown
              inputId="transfer-target-classroom"
              value={targetClassroomId}
              options={targetOptions}
              onChange={(e) => setTargetClassroomId(e.value as string)}
              placeholder="Select a classroom"
              className="w-full"
              disabled={isTransferring}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default ClassroomStudentTransferDialog;
