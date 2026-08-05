import React, { useState, useEffect, useRef } from "react";

export interface ThreeDotMenuItem {
  label: string;
  onClick: () => void;
  className?: string;
}

export type ThreeDotMenuSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface ThreeDotMenuProps {
  actions: ThreeDotMenuItem[];
  size?: ThreeDotMenuSize;
}

const buttonSizeClasses: Record<ThreeDotMenuSize, string> = {
  xs: "p-0.5",
  sm: "p-1",
  md: "p-1.5",
  lg: "p-2",
  xl: "p-2.5",
};

const iconSizeClasses: Record<ThreeDotMenuSize, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
};

export const ThreeDotMenu: React.FC<ThreeDotMenuProps> = ({ actions, size = "md" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        className={`${buttonSizeClasses[size]} rounded-full hover:bg-ui-bg-hover transition-colors text-text-secondary hover:text-text-primary focus:outline-none`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <svg className={iconSizeClasses[size]} fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-ui-surface rounded-md shadow-lg border border-ui-border py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              className={`w-full text-left px-4 py-2.5 text-xs font-medium text-text hover:bg-ui-bg-hover transition-colors ${
                action.className || ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
