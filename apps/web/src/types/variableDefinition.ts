import type { BaseSchema } from "./base";

/**
 * VariableDefinition model with discriminated union for dataType/inputType relationship.
 *
 * Note: option-based inputs (dropdown/selectbutton/multiple-choice) are represented as
 * `dataType: "string"` with an appropriate `inputType`. `dataType: "select"` is deprecated
 * and should not be used going forward.
 */
export type VariableDefinition = BaseSchema & {
  classroomId: string; // Classroom ObjectId reference
  key: string; // Unique within class
  label: string;
  description: string;
  appliesTo: "profile" | "challenge" | "decision" | "profileType" | "outcome";
} & (
    | {
        dataType: "number";
        inputType: "number" | "slider" | "knob" | "multiple-choice";
      }
    | {
        dataType: "string";
        inputType: "text" | "dropdown" | "selectbutton" | "multiple-choice";
      }
    | {
        dataType: "boolean";
        inputType: "checkbox" | "switch";
      }
  ) & {
    //Unused displayType field?
    displayType?:
      | "text"
      | "number"
      | "slider"
      | "dropdown"
      | "checkbox"
      | "knob"
      | "switch"
      | "selectbutton"
      | "multiple-choice";
    options: string[]; // Required for option-based inputs (dropdown/selectbutton/multiple-choice); empty otherwise
    defaultValue: string | number | boolean | null; // Mixed type
    min: number | null;
    max: number | null;
    required: boolean;
    isActive: boolean; // Soft delete flag
  };
