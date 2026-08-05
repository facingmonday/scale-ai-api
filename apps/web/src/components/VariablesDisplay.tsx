import React, { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { VariableDefinitionWithValue } from "../types/decision";
import VariableDefinitionField from "./VariableDefinition";
import { VariableDefinitionFormProvider } from "./VariableDefinitionFormProvider";

type Props = {
  variables: VariableDefinitionWithValue[];
  title?: string;
  description?: string;
  namePrefix?: string;
};

const VariablesDisplay: React.FC<Props> = ({
  variables,
  title,
  description,
  namePrefix = "variables",
}) => {
  const sortedVariables = useMemo(() => {
    return [...variables].sort((a, b) =>
      (a.label || a.key).localeCompare(b.label || b.key)
    );
  }, [variables]);

  // Create a minimal form with variables pre-populated for display
  const form = useForm<{ variables: Record<string, unknown> }>({
    defaultValues: {
      variables: variables.reduce((acc, variable) => {
        acc[variable.key] = variable.value;
        return acc;
      }, {} as Record<string, unknown>),
    },
    mode: "onChange",
  });

  if (sortedVariables.length === 0) {
    return (
      <div className="card">
        <p className="text-text-muted">No variables found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <div>
          <h2 className="heading-lg">{title}</h2>
          {description && <p className="text-text-muted">{description}</p>}
        </div>
      )}

      <FormProvider {...form}>
        <VariableDefinitionFormProvider namePrefix={namePrefix} readOnly={true}>
          <div className="flex flex-wrap">
            {sortedVariables.map((variable) => (
              <div
                key={variable.key}
                className="md:w-1/2 lg:w-1/3 xl:w-1/4 p-2"
              >
                <VariableDefinitionField
                  key={variable.key}
                  definition={variable}
                  readOnly={true}
                />
              </div>
            ))}
          </div>
        </VariableDefinitionFormProvider>
      </FormProvider>
    </div>
  );
};

export default VariablesDisplay;
