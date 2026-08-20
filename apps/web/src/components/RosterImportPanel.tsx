import React, { useEffect, useMemo, useRef, useState } from "react";
import licensingService from "@/services/licensing";
import type { RosterSeat } from "@/types/licensing";

interface RosterImportPanelProps {
  classroomId: string;
  onImported?: () => void;
}

const RosterImportPanel: React.FC<RosterImportPanelProps> = ({
  classroomId,
  onImported,
}) => {
  const [csv, setCsv] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [rosterSeats, setRosterSeats] = useState<RosterSeat[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRosterSeats = async () => {
    if (!classroomId) return;
    try {
      const data = await licensingService.getRosterSeats(classroomId);
      setRosterSeats(data);
      setPage(0);
    } catch (e) {
      console.error("Failed to load roster seats:", e);
    }
  };

  const clearRoster = async () => {
    const confirmed = window.confirm(
      `Clear all ${rosterSeats.length} roster entries? Students who already joined will remain enrolled. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsClearing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await licensingService.clearRoster(classroomId);
      setCsv("");
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(`Cleared ${result.deleted} roster entries.`);
      await loadRosterSeats();
      onImported?.();
    } catch (e) {
      console.error("Failed to clear roster:", e);
      setError("Failed to clear roster.");
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    // This fetch only updates state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRosterSeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId]);

  const importRoster = async () => {
    if (!csv.trim()) return;
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await licensingService.importRoster(classroomId, {
        csv,
      });
      setMessage(
        `Imported ${result.imported} roster rows${
          result.invalid ? ` (${result.invalid} invalid)` : ""
        }.`
      );
      setCsv("");
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadRosterSeats();
      onImported?.();
    } catch (e) {
      console.error("Failed to import roster:", e);
      setError("Failed to import roster.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      setCsv("");
      return;
    }

    setError(null);
    setMessage(null);
    setSelectedFileName(file.name);
    setCsv("");

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setCsv(text);
          setMessage("CSV file successfully loaded. Review the contents below and click 'Import Roster'.");
        }
      };
      reader.onerror = () => {
        setSelectedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setError("Failed to read CSV file.");
      };
      reader.readAsText(file);
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result;
          if (arrayBuffer instanceof ArrayBuffer) {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const csvContent = XLSX.utils.sheet_to_csv(worksheet);
            setCsv(csvContent);
            setMessage("Excel spreadsheet successfully loaded. Review the contents below and click 'Import Roster'.");
          }
        } catch (err) {
          console.error("Error parsing Excel file:", err);
          setSelectedFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setError("Failed to parse Excel spreadsheet. Make sure it is not corrupted.");
        }
      };
      reader.onerror = () => {
        setSelectedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setError("Failed to read Excel file.");
      };
      reader.readAsArrayBuffer(file);
    } else {
      setSelectedFileName(null);
      setCsv("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
    }
  };

  const counts = rosterSeats.reduce(
    (acc, seat) => {
      acc[seat.status] += 1;
      return acc;
    },
    { reserved: 0, claimed: 0, revoked: 0, invalid: 0 } as Record<
      RosterSeat["status"],
      number
    >
  );

  const pageCount = Math.max(1, Math.ceil(rosterSeats.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRosterSeats = useMemo(() => {
    const start = currentPage * pageSize;
    return rosterSeats.slice(start, start + pageSize);
  }, [currentPage, pageSize, rosterSeats]);
  const firstVisibleRow = rosterSeats.length === 0 ? 0 : currentPage * pageSize + 1;
  const lastVisibleRow = Math.min(
    (currentPage + 1) * pageSize,
    rosterSeats.length,
  );

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="heading-md">Roster Import</h2>
        <p className="text-text-muted">
          Upload student emails and optional student IDs. Each imported row is
          reserved on the roster and can limit who joins this class.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Imports add new students and update existing students by email.
          Students omitted from a later import remain on the roster until it is
          cleared.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {message && <p className="text-brand-teal text-sm">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3 rounded border border-ui-border">
          <p className="text-xs text-text-muted">Reserved</p>
          <p className="text-xl font-semibold">{counts.reserved}</p>
        </div>
        <div className="p-3 rounded border border-ui-border">
          <p className="text-xs text-text-muted">Claimed</p>
          <p className="text-xl font-semibold">{counts.claimed}</p>
        </div>
        <div className="p-3 rounded border border-ui-border">
          <p className="text-xs text-text-muted">Revoked</p>
          <p className="text-xl font-semibold">{counts.revoked}</p>
        </div>
        <div className="p-3 rounded border border-ui-border">
          <p className="text-xs text-text-muted">Invalid</p>
          <p className="text-xl font-semibold">{counts.invalid}</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="roster-file">
          Select CSV or Excel Spreadsheet (.csv, .xlsx, .xls)
        </label>
        <input
          ref={fileInputRef}
          id="roster-file"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="input py-2 mb-4"
        />
      </div>

      <div>
        <label className="label" htmlFor="roster-csv">
          Roster Data (CSV Preview)
        </label>
        <textarea
          id="roster-csv"
          className="input min-h-[180px] font-mono text-sm"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"email,studentId,firstName,lastName,section\nstudent@example.edu,S123,Alex,Lee,A"}
        />
      </div>

      <div className="flex justify-between gap-3">
        <button
          className="px-4 py-2 rounded border border-red-400/40 text-red-400 hover:bg-red-400/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={rosterSeats.length === 0 || isClearing || isSubmitting}
          onClick={() => void clearRoster()}
        >
          {isClearing ? "Clearing..." : "Clear Roster"}
        </button>
        <button
          className="btn-teal"
          disabled={
            !selectedFileName || !csv.trim() || isSubmitting || isClearing
          }
          onClick={() => void importRoster()}
        >
          {isSubmitting ? "Importing..." : "Import Roster"}
        </button>
      </div>

      {rosterSeats.length > 0 && (
        <div className="overflow-x-auto border-t border-ui-border pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-ui-border">
                <th className="py-2">Email</th>
                <th className="py-2">Student ID</th>
                <th className="py-2">Name</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRosterSeats.map((seat) => (
                <tr key={seat._id} className="border-b border-ui-border/60">
                  <td className="py-2">{seat.email}</td>
                  <td className="py-2">{seat.studentId || "-"}</td>
                  <td className="py-2">
                    {[seat.firstName, seat.lastName].filter(Boolean).join(" ") ||
                      "-"}
                  </td>
                  <td className="py-2">{seat.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-text-muted">
              Showing {firstVisibleRow}-{lastVisibleRow} of {rosterSeats.length}
              {" "}roster rows
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Rows per page
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <button
                type="button"
                className="btn-outline px-3 py-1.5"
                disabled={currentPage === 0}
                onClick={() => setPage(Math.max(0, currentPage - 1))}
              >
                Previous
              </button>
              <span className="min-w-[5rem] text-center text-xs text-text-muted">
                Page {currentPage + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="btn-outline px-3 py-1.5"
                disabled={currentPage >= pageCount - 1}
                onClick={() =>
                  setPage(Math.min(pageCount - 1, currentPage + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterImportPanel;
