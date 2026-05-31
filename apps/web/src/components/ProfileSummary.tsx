import React, { useMemo } from "react";
import { Tooltip } from "primereact/tooltip";
import { useAuth } from "@/context/AuthContext";
import type { Profile } from "@/types/profile";
import type { ProfileType } from "@/types/profileType";

type Props = {
  profile: Profile | null;
};

const StoreSummary: React.FC<Props> = ({ profile }) => {
  const { activeClassroom } = useAuth();

  const profileType = useMemo(() => {
    if (!profile?.profileType) return null;
    return typeof profile.profileType === "string"
      ? null
      : (profile.profileType as ProfileType);
  }, [profile]);

  const storeTypeLabel = useMemo(() => {
    if (!profile) return null;
    if (profileType?.label) return profileType.label;
    // Fallback to storeTypeLabel if it exists on the profile
    if ("storeTypeLabel" in profile && profile.storeTypeLabel) {
      return profile.storeTypeLabel as string;
    }
    return null;
  }, [profile, profileType]);

  const storeTypeVariables = useMemo(() => {
    if (!profileType?.variables) return [];
    const variables = profileType.variables;
    return Object.entries(variables).map(([key, value]) => ({
      key,
      value,
    }));
  }, [profileType]);

  // Create a map of variable definitions by key for tooltip descriptions
  const variableDescriptions = useMemo(() => {
    const defs = activeClassroom?.variableDefinitions?.profileType ?? [];
    return defs.reduce((acc, def) => {
      acc[def.key] = def.description;
      return acc;
    }, {} as Record<string, string>);
  }, [activeClassroom]);

  // Format variable key for display (convert kebab-case to title case)
  const formatVariableKey = (key: string): string => {
    return key
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (typeof value === "number") {
      // Format numbers with appropriate precision
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (value === null || value === undefined) {
      return "—";
    }
    return String(value);
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-start gap-4 mb-4">
        {profile.imageUrl && (
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-ui-border bg-ui-muted">
            <img
              src={profile.imageUrl}
              alt={profile.shopName || "Profile"}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {profile.shopName && (
            <h3 className="heading-md mb-1">{profile.shopName}</h3>
          )}
          {/* {profile.studentId && (
            <p className="text-text-muted text-sm">
              Student ID: {profile.studentId}
            </p>
          )} */}
          {storeTypeLabel && (
            <p className="text-text-muted text-sm">{storeTypeLabel}</p>
          )}
        </div>
      </div>

      {storeTypeVariables.length > 0 && (
        <>
          <div>
            <h4 className="heading-md mb-3 text-sm font-medium text-text-secondary uppercase tracking-wide">
              Profile Information
            </h4>
          </div>
          <div className="w-full flex flex-wrap p-0 m-0">
            {storeTypeVariables.map(({ key, value }) => {
              const description = variableDescriptions[key];
              const tooltipId = `profile-type-var-${key}`;
              return (
                <div key={key} className="xs:w-full sm-w-full md:w-1/4">
                  {description && (
                    <Tooltip
                      target={`.${tooltipId}`}
                      position="top"
                      content={description}
                    />
                  )}
                  <div
                    className={`${tooltipId} flex justify-between gap-2 text-sm mr-2 my-1 ${
                      description ? "cursor-help" : ""
                    }`}
                  >
                    <div className="text-text-muted font-medium truncate flex-none">
                      {formatVariableKey(key)}
                    </div>
                    <div className="text-text-primary font-semibold tabular-nums whitespace-nowrap text-right flex-none">
                      {formatValue(value)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default StoreSummary;
