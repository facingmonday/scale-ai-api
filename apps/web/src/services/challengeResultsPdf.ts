import challengeService from "./challenge";
import outcomeService from "./outcome";
import profileTypeService from "./profileType";
import variableDefinitionService from "./variableDefinition";
import type { Challenge } from "../types/challenge";
import type { Classroom } from "../types/classroom";
import type { Outcome } from "../types/outcome";
import type { ProfileType } from "../types/profileType";
import type { VariableDefinition } from "../types/variableDefinition";
import { buildChallengeResultsReport } from "../utils/challengeResultsReport";
import regularFontUrl from "../assets/fonts/DejaVuSans.ttf?url";
import boldFontUrl from "../assets/fonts/DejaVuSans-Bold.ttf?url";

function unwrap<T>(response: T | { data: T }): T {
  return response && typeof response === "object" && "data" in response
    ? response.data : response as T;
}

async function fontBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load PDF font.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export async function downloadChallengeResultsPdf(challengeId: string, classroom: Classroom) {
  const [challengeResponse, outcomeResponse, profileResponse, definitionResponse, renderer, regular, bold] =
    await Promise.all([
      challengeService.getById(challengeId, "admin"),
      outcomeService.getOutcome(challengeId),
      profileTypeService.getAll("admin", { classroomId: classroom._id }),
      variableDefinitionService.getAll(classroom._id, "outcome", challengeId),
      import("../utils/challengeResultsPdf"),
      fontBase64(regularFontUrl), fontBase64(boldFontUrl),
    ]);
  const challenge = unwrap<Challenge>(challengeResponse);
  if (challenge.classroomId !== classroom._id) throw new Error("Challenge classroom changed.");
  const report = buildChallengeResultsReport({
    challenge, classroom, outcome: unwrap<Outcome | null>(outcomeResponse),
    profileTypes: unwrap<ProfileType[]>(profileResponse),
    outcomeDefinitions: unwrap<VariableDefinition[]>(definitionResponse),
  });
  // Yield for the busy indicator before the synchronous PDF layout work.
  await new Promise(resolve => window.setTimeout(resolve, 0));
  const doc = renderer.createChallengeResultsPdf(report, { regular, bold });
  await doc.save(report.filename, { returnPromise: true });
}
