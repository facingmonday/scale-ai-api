import React, { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import {
  buildClassroomJoinUrl,
  copyTextToClipboard,
} from "@/utils/classroomJoinLink";

interface ClassroomJoinLinkPanelProps {
  classroomId: string;
}

const ClassroomJoinLinkPanel: React.FC<ClassroomJoinLinkPanelProps> = ({
  classroomId,
}) => {
  const { organization } = useAuth();
  const globalContext = useGlobalContext();

  const joinUrl = useMemo(() => {
    const orgId = organization?.id;
    if (!orgId || !classroomId) return "";
    return buildClassroomJoinUrl(orgId, classroomId);
  }, [organization?.id, classroomId]);

  const handleCopy = async () => {
    if (!joinUrl) {
      globalContext?.showToast?.("Unable to generate join link", "error");
      return;
    }

    try {
      await copyTextToClipboard(joinUrl);
      globalContext?.showToast?.("Join link copied", "success");
    } catch (e) {
      console.error("Failed to copy join link:", e);
      globalContext?.showToast?.("Failed to copy join link", "error");
    }
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="heading-md">Join Link</h2>
        <p className="text-text-muted">
          Share this link with students so they can join the class. Required when
          join policy is set to invite link.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          className="input flex-1 font-mono text-sm"
          value={joinUrl}
          readOnly
          aria-label="Classroom join link"
        />
        <button
          type="button"
          className="btn-outline shrink-0"
          onClick={() => void handleCopy()}
          disabled={!joinUrl}
        >
          Copy link
        </button>
      </div>
    </div>
  );
};

export default ClassroomJoinLinkPanel;
