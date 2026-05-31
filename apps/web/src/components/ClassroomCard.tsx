import React from "react";
import type { ClassroomWithVirtuals } from "../types/classroom";

interface ClassroomCardProps {
  classroom: ClassroomWithVirtuals;
  onClick?: () => void;
  onMenuClick?: (event: React.MouseEvent) => void;
  showJoinButton?: boolean;
  onJoinClick?: () => void;
  isJoining?: boolean;
  isEnrolled?: boolean;
}

// Generate a consistent color based on classroom ID
const getCardColor = (id: string | undefined): string => {
  const colors = [
    "bg-[#1a1a1a]", // Black
    "bg-[#556b2f]", // Dark olive green
    "bg-brand-blue", // Blue
    "bg-brand-teal", // Teal
    "bg-brand-orange", // Orange
  ];
  // Simple hash to get consistent color per classroom
  // Use a default value if id is undefined
  const idString = id || "";
  const hash = idString
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] || colors[0];
};

const ClassroomCard: React.FC<ClassroomCardProps> = ({
  classroom,
  onClick,
  showJoinButton = false,
  onJoinClick,
  isJoining = false,
  isEnrolled = false,
}) => {
  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onJoinClick?.();
  };

  return (
    <div className="max-w-80">
      {/* Visual Header Area */}
      <div className="rounded-t-lg overflow-hidden max-h-48 max-w-80">
        {classroom.imageUrl ? (
          <img
            src={classroom.imageUrl}
            alt={classroom.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className={`w-full h-48 ${getCardColor(classroom._id)}`} />
        )}
      </div>
      <div
        className={`bg-ui-surface shadow-sm border border-ui-border overflow-hidden rounded-b-lg p-4 max-w-80 ${
          !showJoinButton ? "cursor-pointer hover:shadow-md" : ""
        } transition-shadow`}
        onClick={!showJoinButton ? onClick : undefined}
      >
        {/* Text Content */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="heading-md text-text-primary">{classroom.name}</h3>
            {isEnrolled && (
              <span className="inline-flex items-center rounded-full bg-brand-teal/10 text-brand-teal px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                Enrolled
              </span>
            )}
          </div>
          {(classroom?.ownership?.firstName ||
            classroom?.ownership?.lastName) && (
            <p className="text-sm text-text-muted">
              Professor: {classroom?.ownership?.firstName}{" "}
              {classroom?.ownership?.lastName}
            </p>
          )}
          <p className="text-sm text-text-muted text-wrap break-words">
            {classroom.description || ""}
          </p>
        </div>

        {/* Join Button Section */}
        {showJoinButton && (
          <div className="mt-4 space-y-2">
            <button
              onClick={handleJoinClick}
              disabled={isJoining}
              className="btn-teal w-full"
            >
              {isEnrolled
                ? "Set Actve Class"
                : isJoining
                ? "Joining..."
                : "Join Classroom"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassroomCard;
