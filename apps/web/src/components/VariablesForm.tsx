import React, { useMemo } from "react";
import type { VariableDefinitionWithValue } from "../types/decision";
import VariableDefinitionField from "./VariableDefinition";
import { VariableDefinitionFormProvider } from "./VariableDefinitionFormProvider";
import VariableDefinitionsAddButton from "./VariableDefinitionsAddButton";
import { useAuth } from "@/context/AuthContext";

type Props = {
  variables: VariableDefinitionWithValue[];
  readOnly?: boolean;
  title?: string;
  description?: string;
  namePrefix?: string;
  showAddButton?: boolean;
  defaultAppliesTo?:
  | "profile"
  | "profileType"
  | "challenge"
  | "decision"
  | "outcome";
  challengeId?: string | null;
  onSave?: () => void;
};

const VariablesForm: React.FC<Props> = ({
  variables,
  readOnly = false,
  title = "Variables",
  description,
  namePrefix = "variables",
  showAddButton = false,
  defaultAppliesTo = "profile",
  challengeId = null,
  onSave = () => { },
}) => {
  const sortedVariables = useMemo(() => {
    return [...variables].sort((a, b) =>
      (a.label || a.key).localeCompare(b.label || b.key)
    );
  }, [variables]);

  const { activeClassroom } = useAuth();

  if (sortedVariables.length === 0) {
    if (showAddButton) {
      return (
        <div className="space-y-4 w-full">
          <div className="flex items-center justify-between gap-4 w-full">
            <div>
              <h2 className="heading-lg">{title}</h2>
              {description && <p className="text-text-muted">{description}</p>}
            </div>
            <div>
              <VariableDefinitionsAddButton
                classroomId={activeClassroom?._id ?? ""}
                variant="create"
                defaultAppliesTo={defaultAppliesTo}
                challengeId={challengeId}
                onSaved={onSave}
              />
            </div>
          </div>
          <div className="card">
            <p className="text-text-muted">No variables found.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="card">
        <p className="text-text-muted">No variables found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between gap-4 w-full">
        <div>
          <h2 className="heading-lg">{title}</h2>
          {description && <p className="text-text-muted">{description}</p>}
        </div>
        <div>
          {showAddButton && (
            <VariableDefinitionsAddButton
              classroomId={activeClassroom?._id ?? ""}
              variant="create"
              defaultAppliesTo={defaultAppliesTo}
              challengeId={challengeId}
              onSaved={onSave}
            />
          )}
        </div>
      </div>

      <VariableDefinitionFormProvider
        namePrefix={namePrefix}
        readOnly={readOnly}
      >
        <div className="flex flex-wrap gap-4">
          {sortedVariables
            .filter((variable) => {
              if (readOnly) {
                return true;
              }
              return variable.isActive;
            })
            .map((variable) => (
              <div key={variable.key} className="md:w-1/2 lg:w-1/3 xl:w-1/4">
                <VariableDefinitionField
                  key={variable.key}
                  definition={variable}
                  readOnly={readOnly}
                />
              </div>
            ))}
        </div>
      </VariableDefinitionFormProvider>
    </div>
  );
};

export default VariablesForm;
