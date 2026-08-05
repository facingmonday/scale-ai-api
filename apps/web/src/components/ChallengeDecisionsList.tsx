import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import decisionService from "../services/decision";
import type {
  SubmissionWithMember,
} from "../types/decision";
import challengeService from "@/services/challenge";
import { getDecisionGenerationMethodLabel } from "@/constants";
import ExportDialog from "./ExportDialog";
import { useAuth } from "@/context/AuthContext";

// Extended type to include processingStatus which is returned from the API
type SubmissionWithProcessingStatus = SubmissionWithMember & {
  processingStatus?: string;
  profile?: {
    shopName?: string;
    studentId?: string;
  };
  ledger?: {
    metrics?: Record<string, unknown>;
  };
  generation?: {
    method?: string;
  };
};

interface ScenarioSubmissionsListProps {
  challengeId: string;
}

const statusBadgeClass: Record<string, string> = {
  completed: "badge-success",
  success: "badge-success",
  pending: "badge-warning",
  running: "badge-info",
  processing: "badge-info",
  failed: "badge-danger",
  error: "badge-danger",
};

const ScenarioSubmissionsList: React.FC<ScenarioSubmissionsListProps> = ({
  challengeId,
}) => {
  const navigate = useNavigate();
  const { activeClassroom } = useAuth();
  const [decisions, setSubmissions] = useState<
    SubmissionWithProcessingStatus[]
  >([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Pagination state
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(25);

  // Sorting state
  const [sortField, setSortField] = useState<string>("submittedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchSubmissions = useCallback(
    async (silent = false) => {
      if (!challengeId || !activeClassroom?._id) return;

      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const page = Math.floor(first / rows);

        const response = await decisionService.search({
          classroomId: activeClassroom._id,
          page,
          pageSize: rows,
          sortField: sortField || "submittedAt",
          sortDirection: sortOrder || "desc",
          filters: [
            { field: "challengeId", operator: "eq", value: challengeId },
          ],
          includeJobs: false,
        });

        const responseData = response.data || [];
        const total = response.total || 0;

        setSubmissions(responseData as SubmissionWithProcessingStatus[]);
        setTotalRecords(total);
      } catch (err) {
        console.error("Failed to fetch decisions:", err);
        if (!silent) {
          setError("Failed to load decisions");
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [challengeId, activeClassroom, first, rows, sortField, sortOrder]
  );

  // Fetch decisions when filters, pagination, or sort change
  useEffect(() => {
    if (!activeClassroom?._id) return;
    void fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, activeClassroom, first, rows, sortField, sortOrder]);

  const onPage = (e: { first: number; rows: number }) => {
    setFirst(e.first);
    setRows(e.rows);
  };

  const onSort = (e: {
    sortField?: string;
    sortOrder?: 0 | 1 | -1 | null;
  }) => {
    // Special handling for generation.method column: 
    // If it's already sorted by generation.method, clicking again switches to submittedAt asc
    if (
      e.sortField === "generation.method" && 
      sortField === "generation.method"
    ) {
      // Switch to submittedAt ascending on second click
      setSortField("submittedAt");
      setSortOrder("asc");
      return;
    }
    
    setSortField(e.sortField || "");
    if (e.sortOrder === 1) {
      setSortOrder("asc");
    } else if (e.sortOrder === -1) {
      setSortOrder("desc");
    } else {
      // When sortOrder is null, default to desc for other columns
      setSortOrder("desc");
    }
  };

  const handleExportClick = () => {
    setShowExportDialog(true);
  };

  const handleExport = useCallback(async () => {
    return await challengeService.exportSubmissions(challengeId, {});
  }, [challengeId]);

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => void fetchSubmissions()} className="btn-teal">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Decisions DataTable */}
        {isLoading ? (
          <div className="card">
            <p className="text-text-muted">Loading decisions...</p>
          </div>
        ) : (
          <DataTable
            value={decisions}
            emptyMessage="No decisions found"
            loading={isLoading}
            dataKey="_id"
            onRowClick={(e) => {
              const decision = e.data as SubmissionWithMember;
              if (decision.member?._id) {
                navigate(`/decisions/${decision._id}`);
              }
            }}
            selectionMode="single"
            paginator
            rows={rows}
            first={first}
            totalRecords={totalRecords}
            onPage={onPage}
            onSort={onSort}
            sortField={sortField}
            sortOrder={sortOrder === "asc" ? 1 : sortOrder === "desc" ? -1 : null}
            rowsPerPageOptions={[10, 25, 50, 100]}
            lazy
            header={
              <div className="flex flex-row justify-between items-center">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => navigate(`/decisions?challengeId=${challengeId}`)}
                    disabled={isLoading}
                    aria-label="View all decisions"
                  >
                    <i className="pi pi-list mr-2" />
                    View All Decisions
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => void fetchSubmissions()}
                    disabled={isLoading}
                    aria-label="Refresh decisions"
                  >
                    <i className="pi pi-refresh mr-2" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="btn-teal"
                    onClick={handleExportClick}
                  >
                    Export
                  </button>
                </div>
              </div>
            }
          >
            <Column
              header=""
              sortable
              sortField="generation.method"
              style={{
                width: "48px",
                minWidth: "40px",
                maxWidth: "56px",
                textAlign: "center",
              }}
              body={(rowData) => {
                const method = rowData?.generation?.method;
                const tooltip = method
                  ? getDecisionGenerationMethodLabel(method)
                  : "Unknown generation method";
                let icon = null;
                switch (method) {
                  case "MANUAL":
                    icon = "pi pi-pencil";
                    break;
                  case "AI":
                    icon = "pi pi-robot";
                    break;
                  case "FORWARDED_PREVIOUS":
                    icon = "pi pi-arrow-right-arrow-left";
                    break;
                  case "AI_FALLBACK":
                    icon = "pi pi-exclamation-triangle";
                    break;
                  case "DEFAULTS":
                    icon = "pi pi-sliders-h";
                    break;
                  default:
                    icon = "pi pi-question";
                }
                return (
                  <span
                    title={tooltip}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      fontSize: "1.2rem",
                    }}
                  >
                    <i className={icon} aria-label={tooltip} />
                  </span>
                );
              }}
            />
            <Column
              header="Name"
              sortable
              sortField="member.firstName"
              body={(rowData) => {
                const first = rowData.member?.firstName || "";
                const last = rowData.member?.lastName || "";
                return first || last ? `${first} ${last}`.trim() : "—";
              }}
            />
            <Column
              header="Profile Name"
              sortable
              sortField="profile.shopName"
              body={(rowData) => {
                return rowData.profile?.shopName || "—";
              }}
            />
            <Column
              header="Student ID"
              sortable
              sortField="profile.studentId"
              body={(rowData) => rowData.profile?.studentId || "—"}
            />
            <Column
              field="processingStatus"
              header="Processing Status"
              sortable
              sortField="processingStatus"
              body={(rowData) => {
                const decision = rowData as SubmissionWithProcessingStatus;
                const status = decision.processingStatus;
                if (!status) return "—";
                return (
                  <span className={`badge ${statusBadgeClass[status] || "badge-info"}`}>
                    {status}
                  </span>
                );
              }}
            />
          </DataTable>
        )}

      <ExportDialog
        visible={showExportDialog}
        onHide={() => setShowExportDialog(false)}
        onExport={handleExport}
        exportName="decisions"
      />
    </div>
  );
};

export default ScenarioSubmissionsList;
