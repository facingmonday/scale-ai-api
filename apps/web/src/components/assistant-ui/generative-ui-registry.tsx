import { ClassRoster } from "./components/ClassRoster";
import { StudentLedger } from "./components/StudentLedger";
import { StudentProfile } from "./components/StudentProfile";
import { StudentSubmissions } from "./components/StudentSubmissions";
import { ScenarioDetails } from "./components/ScenarioDetails";
import { ClassroomSummary } from "./components/ClassroomSummary";

export { ClassRoster } from "./components/ClassRoster";
export { StudentLedger } from "./components/StudentLedger";
export { StudentProfile } from "./components/StudentProfile";
export { StudentSubmissions } from "./components/StudentSubmissions";
export { ScenarioDetails } from "./components/ScenarioDetails";
export { ClassroomSummary } from "./components/ClassroomSummary";

// Central allowlist for GenerativeUI mapping
export const componentsAllowlist = {
  ClassRoster,
  StudentLedger,
  StudentProfile,
  StudentSubmissions,
  ScenarioDetails,
  ClassroomSummary
};
