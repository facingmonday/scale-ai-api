import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import enrollmentService from "@/services/enrollment";
import type { ClassroomWithVirtuals } from "@/types/classroom";
import LoadingOverlay from "./LoadingOverlay";

export default function ClassroomSwitcher() {
  const { activeClassroom, setNewActiveClassroom, clearActiveClassroom } =
    useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [classrooms, setClassrooms] = useState<ClassroomWithVirtuals[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch classrooms when dropdown opens
  useEffect(() => {
    if (isOpen && !hasFetchedRef.current) {
      fetchClassrooms();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const fetchClassrooms = async () => {
    setIsLoading(true);
    try {
      const data = await enrollmentService.getMyClasses();
      setClassrooms(data.data || []);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error("Failed to fetch classrooms:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassroomSelect = async (classroom: ClassroomWithVirtuals) => {
    if (classroom._id) {
      try {
        await setNewActiveClassroom(classroom);
        setIsOpen(false);
      } catch (err) {
        console.error("Failed to switch classroom:", err);
      }
    }
  };

  const handleViewAllClassrooms = async () => {
    try {
      await clearActiveClassroom();
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to clear active classroom:", err);
    }
  };

  if (!activeClassroom) {
    return null;
  }

  return (
    <div className="relative w-full md:w-auto" ref={dropdownRef}>
      {/* Trigger Button */}
      <button onClick={() => setIsOpen(!isOpen)} className="classroom-switcher">
        <span className="classroom-switcher-name">{activeClassroom.name}</span>
        <svg
          className={`classroom-switcher-icon ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="classroom-switcher-dropdown">
          <LoadingOverlay loading={isLoading} />
          {/* Classroom List */}
          <div className="classroom-switcher-list">
            {classrooms.map((classroom) => {
              const isActive = classroom._id === activeClassroom._id;

              return (
                <button
                  key={classroom._id}
                  onClick={() => handleClassroomSelect(classroom)}
                  className={`classroom-switcher-item ${
                    isActive ? "classroom-switcher-item-active" : ""
                  }`}
                  disabled={isActive}
                >
                  <span className="classroom-switcher-item-name">
                    {classroom.name}
                  </span>
                  {isActive && (
                    <svg
                      className="classroom-switcher-check"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="classroom-switcher-divider" />

          {/* View All Button */}
          <button
            onClick={handleViewAllClassrooms}
            className="classroom-switcher-view-all"
          >
            Exit Classrooms
          </button>
        </div>
      )}
    </div>
  );
}
