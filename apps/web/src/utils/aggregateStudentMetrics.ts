import type { MetricDefinition } from "../types/metric";

/** Aggregate all released classroom results, ordered newest challenge first. */
export function aggregateStudentMetrics(
  results: ReadonlyArray<{ metrics: Record<string, unknown> }>,
  definitions: ReadonlyArray<MetricDefinition>
): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};

  for (const definition of definitions) {
    const values = results
      .map((result) => result.metrics[definition.key])
      .filter((value) => value !== undefined && value !== null);
    if (definition.dataType !== "number") {
      if (values.length) metrics[definition.key] = values[0];
      continue;
    }

    const numbers = values.filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value)
    );
    if (!numbers.length) continue;

    switch (definition.aggregation) {
      case "sum":
        metrics[definition.key] = numbers.reduce((sum, value) => sum + value, 0);
        break;
      case "avg":
        metrics[definition.key] = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
        break;
      case "min":
        metrics[definition.key] = numbers.reduce((min, value) => Math.min(min, value));
        break;
      case "max":
        metrics[definition.key] = numbers.reduce((max, value) => Math.max(max, value));
        break;
      default:
        // Balances and non-aggregating metrics must never be added across weeks.
        metrics[definition.key] = numbers[0];
    }
  }

  return metrics;
}
