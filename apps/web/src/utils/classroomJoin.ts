import type { ClassroomWithVirtuals } from "@/types/classroom";
import type { JoinPolicy } from "@/types/licensing";

export function canSelfJoinFromClassList(
  classroom: ClassroomWithVirtuals
): boolean {
  if (classroom.isActive === false) return false;
  const policy: JoinPolicy = classroom.joinPolicy || "invite_link";
  return policy === "open";
}

export function getClassListJoinHint(
  classroom: ClassroomWithVirtuals,
  isEnrolled: boolean
): string | null {
  if (isEnrolled) return null;
  if (classroom.isActive === false) {
    return "This class is closed to new enrollments.";
  }

  const policy: JoinPolicy = classroom.joinPolicy || "invite_link";
  if (policy === "closed") {
    return "This class is closed to new enrollments.";
  }
  if (policy === "roster_only") {
    return "This class is limited to students on the imported roster.";
  }
  if (policy === "invite_link") {
    return "Ask your instructor for an invite link to join this class.";
  }
  return null;
}
