import React, { useMemo } from "react";
import type { LedgerEntry } from "@/types/ledger";
import type { VariableDefinitionWithValue } from "@/types/decision";
import VariablesDisplay from "./VariablesDisplay";
import LedgerVisualization from "./LedgerVisualization";
import { Accordion, AccordionTab } from "primereact/accordion";

interface LastWeekResultsProps {
  ledger: LedgerEntry;
  submissionVariableDefinitions: VariableDefinitionWithValue[];
}

const LastWeekResults: React.FC<LastWeekResultsProps> = ({
  ledger,
  submissionVariableDefinitions,
}) => {
  // Transform decision variables from ledger calculationContext into VariableDefinitionWithValue format
  const submissionVariablesWithValues = useMemo(() => {
    const decisionVariables = ledger.calculationContext?.decisionVariables;
    if (!decisionVariables) {
      return [];
    }

    return submissionVariableDefinitions
      .filter((def) =>
        Object.prototype.hasOwnProperty.call(decisionVariables, def.key)
      )
      .map((def) => ({
        ...def,
        value:
          decisionVariables[def.key] ??
          def.defaultValue ??
          (def.dataType === "number" ? 0 : ""),
      })) as VariableDefinitionWithValue[];
  }, [
    ledger.calculationContext?.decisionVariables,
    submissionVariableDefinitions,
  ]);

  return (
    <div className="card">
      <div className="mb-2">
        <h2 className="heading-lg mb-2">Last Week's Performance</h2>
        <p className="text-text-muted text-md">
          Review your previous performance to inform your decisions this week.
        </p>
      </div>

      <div className="last-week-results-accordion-wrapper">
        <Accordion className="last-week-results-accordion">
          <AccordionTab header="View Your Decisions">
            <div className="last-week-results-content">
              {submissionVariablesWithValues.length > 0 && (
                <VariablesDisplay variables={submissionVariablesWithValues} />
              )}
            </div>
          </AccordionTab>
        </Accordion>

        <Accordion className="last-week-results-accordion">
          <AccordionTab header="View Your Results">
            <div className="last-week-results-content">
              <LedgerVisualization ledger={ledger} />
            </div>
          </AccordionTab>
        </Accordion>
      </div>
    </div>
  );
};

export default LastWeekResults;
