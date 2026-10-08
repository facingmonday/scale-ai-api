import type { VariableDefinition } from "../types/variableDefinition";

export function normalizeVariableAnswer<T>(dataType: string, value: T): T | number | boolean {
  if (value === undefined || value === null || value === "") return value;
  if (dataType === "number" && typeof value === "string" && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (dataType === "boolean" && typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return value;
}

export function validateVariableAnswer(definition: VariableDefinition, raw: unknown): true | string {
  const value = normalizeVariableAnswer(definition.dataType, raw);
  if (value === undefined || value === null || value === "") {
    return definition.required ? "This field is required" : true;
  }
  if (definition.dataType === "boolean") {
    return typeof value === "boolean" || "Choose Yes or No";
  }
  if (definition.dataType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Enter a valid number";
    if (definition.min != null && value < definition.min) return `Must be at least ${definition.min}`;
    if (definition.max != null && value > definition.max) return `Must be at most ${definition.max}`;
  }
  return true;
}

export function variableFieldId(name: string): string {
  return `variable-${encodeURIComponent(name)}`;
}

export function focusVariableField(name: string) {
  const container = document.getElementById(variableFieldId(name));
  container?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  const input = container?.querySelector<HTMLElement>(
    'input:not([disabled]),button:not([disabled]),[tabindex="0"]',
  );
  (input ?? container)?.focus({ preventScroll: true });
}
