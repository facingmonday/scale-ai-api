import ChallengeScheduleFields from "../ChallengeScheduleFields";
import type {
  WizardScheduleProposal,
  WizardSchedule,
} from "../../types/challengeWizard";

export default function ScheduleEditor({
  proposal,
  onChange,
}: {
  proposal: WizardScheduleProposal;
  onChange: (schedule: WizardSchedule) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold">Suggested schedule</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {proposal.explanation}
        </p>
        <p className="mt-1 text-sm font-medium">
          All times in {proposal.timeZone.replaceAll("_", " ")}. These dates
          are suggestions; adjust them to fit your class.
        </p>
      </div>
      <ChallengeScheduleFields
        values={proposal.schedule}
        onChange={(patch) => onChange({ ...proposal.schedule, ...patch })}
      />
    </section>
  );
}
