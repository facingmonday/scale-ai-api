import React from "react";
import {
  VariableDefinitionFormContext,
  type VariableDefinitionFormContextValue,
} from "./VariableDefinitionFormContext";

export const VariableDefinitionFormProvider: React.FC<
  React.PropsWithChildren<Partial<VariableDefinitionFormContextValue>>
> = ({ children, namePrefix = "variables", readOnly = false }) => {
  return (
    <VariableDefinitionFormContext.Provider value={{ namePrefix, readOnly }}>
      {children}
    </VariableDefinitionFormContext.Provider>
  );
};

export default VariableDefinitionFormProvider;
