import React, { useState } from "react";
import InviteStudentDialog from "@/components/InviteStudentDialog";

type Props = {
  classroomId: string;
  disabled?: boolean;
  onSuccess?: () => void;
};

const ClassroomInviteStudentButton: React.FC<Props> = ({
  classroomId,
  disabled = false,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-teal"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        Invite student
      </button>

      <InviteStudentDialog
        visible={isOpen}
        onHide={() => setIsOpen(false)}
        classroomId={classroomId}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default ClassroomInviteStudentButton;


