export type ProcessingSettings = {
  simulationMode: "direct" | "batch";
  simulationConcurrency: number;
};

export default function ChallengeProcessingFields({
  values,
  onChange,
  disabled = false,
}: {
  values: ProcessingSettings;
  onChange: (values: ProcessingSettings) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-2">
        <span className="label">Processing mode</span>
        <select
          className="input"
          value={values.simulationMode}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...values,
              simulationMode: event.target
                .value as ProcessingSettings["simulationMode"],
            })
          }
        >
          <option value="direct">Individual</option>
          <option value="batch">Batch</option>
        </select>
      </label>
      {values.simulationMode === "direct" && (
        <label className="flex flex-col gap-2">
          <span className="label">Students at a time</span>
          <input
            type="number"
            className="input"
            min={1}
            max={20}
            step={1}
            required
            value={values.simulationConcurrency}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...values,
                simulationConcurrency: event.target.valueAsNumber,
              })
            }
          />
        </label>
      )}
      <p className="text-sm text-text-muted md:col-span-2">
        {values.simulationMode === "direct"
          ? "Calculate students individually, starting the next student as soon as a slot opens."
          : "Submit the challenge together and wait for the batch to finish."}{" "}
        Feedback release mode controls when students see results and receive
        their results email.
      </p>
    </div>
  );
}
