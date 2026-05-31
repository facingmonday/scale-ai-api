import { createContext, useContext } from "react";

export type VariableDefinitionFormContextValue = {
  /** Base path in RHF values, e.g. "variables" */
  namePrefix: string;
  readOnly: boolean;
};

export const VariableDefinitionFormContext =
  createContext<VariableDefinitionFormContextValue | null>(null);

export function useVariableDefinitionFormContext() {
  const ctx = useContext(VariableDefinitionFormContext);
  if (!ctx) {
    throw new Error(
      "useVariableDefinitionFormContext must be used within VariableDefinitionFormProvider"
    );
  }
  return ctx;
}
