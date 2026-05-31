import type { BaseSchema } from "./base";

export type MetricDataType = "number" | "string" | "boolean";

export type MetricFormat =
  | "currency"
  | "count"
  | "units"
  | "percent"
  | "text";

export type MetricAggregation = "sum" | "avg" | "last" | "max" | "min" | "none";

export interface MetricDisplayIn {
  table: boolean;
  kpi: boolean;
  chart: boolean;
  leaderboard: boolean;
  detail: boolean;
}

/**
 * MetricDefinition — declares one classroom-scoped output metric.
 * Parallel to VariableDefinition but for AI-produced values written to the ledger.
 */
export interface MetricDefinition extends BaseSchema {
  classroomId: string;
  key: string;
  label: string;
  description?: string;
  dataType: MetricDataType;
  format: MetricFormat;
  aiPromptRule?: string;
  aggregation: MetricAggregation;
  displayIn: MetricDisplayIn;
  defaultInitialValue?: number | string | boolean | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateMetricDefinitionRequest {
  key: string;
  label: string;
  description?: string;
  dataType: MetricDataType;
  format?: MetricFormat;
  aiPromptRule?: string;
  aggregation?: MetricAggregation;
  displayIn?: Partial<MetricDisplayIn>;
  defaultInitialValue?: number | string | boolean | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateMetricDefinitionRequest = Partial<CreateMetricDefinitionRequest>;
