import { useRef, useState } from "react";
import type { Challenge } from "../types/challenge";
import type { Classroom } from "../types/classroom";
import { useGlobalContext } from "../context/GlobalContext";
import { canDownloadChallengeResults } from "../utils/challengeResultsReport";

export default function DownloadChallengeResultsButton({ challenge, classroom }: {
  challenge: Challenge;
  classroom: Classroom;
}) {
  const global = useGlobalContext();
  const [isDownloading, setIsDownloading] = useState(false);
  const busy = useRef(false);
  const available = canDownloadChallengeResults(challenge);

  const download = async () => {
    if (busy.current || !available) return;
    busy.current = true;
    setIsDownloading(true);
    try {
      const { downloadChallengeResultsPdf } = await import("../services/challengeResultsPdf");
      await downloadChallengeResultsPdf(challenge._id, classroom);
      global?.showToast("Results PDF downloaded.", "success");
    } catch (error) {
      console.error("Failed to download challenge results PDF:", error);
      global?.showToast("Couldn’t download results PDF. Please try again.", "error");
    } finally {
      busy.current = false;
      setIsDownloading(false);
    }
  };

  return (
    <button type="button" className="btn-outline shrink-0" onClick={() => void download()}
      disabled={!available || isDownloading} aria-busy={isDownloading}
      title={available ? undefined : "Available when challenge results are complete"}>
      <i className={isDownloading ? "pi pi-spin pi-spinner" : "pi pi-download"} aria-hidden="true" />
      <span role="status">{isDownloading ? "Preparing PDF…" : "Download results PDF"}</span>
    </button>
  );
}
