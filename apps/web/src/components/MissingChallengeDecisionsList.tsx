import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import decisionService from "../services/decision";

type MissingSubmission = {
  _id: string;
  firstName: string;
  lastName: string;
  clerkUserId: string;
  studentId: string | null;
  profile: {
    _id: string;
    shopName: string;
    studentId: string;
  } | null;
};

interface MissingScenarioSubmissionsListProps {
  challengeId: string;
}

const MissingScenarioSubmissionsList: React.FC<MissingScenarioSubmissionsListProps> = ({
  challengeId,
}) => {
  const navigate = useNavigate();
  const [missingSubmissions, setMissingSubmissions] = useState<MissingSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);

  const fetchMissingSubmissions = useCallback(async () => {
    if (!challengeId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await decisionService.getMissingSubmissionsForScenario(
        challengeId
      );

      const responseData = response as {
        success?: boolean;
        data?: {
          missingSubmissions?: MissingSubmission[];
        };
        missingSubmissions?: MissingSubmission[];
      };

      const missingSubs =
        responseData.data?.missingSubmissions ||
        responseData.missingSubmissions ||
        [];

      setMissingSubmissions(missingSubs);
    } catch (err) {
      console.error("Failed to fetch missing decisions:", err);
      setError("Failed to load missing decisions");
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (challengeId) {
      void fetchMissingSubmissions();
    }
  }, [challengeId, fetchMissingSubmissions]);

  useEffect(() => {
    // Reset pagination when challenge changes
    setFirst(0);
  }, [challengeId]);

  const onPage = (e: { first: number; rows: number }) => {
    setFirst(e.first);
    setRows(e.rows);
  };

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => void fetchMissingSubmissions()} className="btn-teal">
          Try Again
        </button>
      </div>
    );
  }

  if (missingSubmissions.length === 0 && !isLoading) {
    return (
      <div className="card">
        <h2 className="heading-md">No missing decisions for this challenge</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="heading-md mb-4">
          Missing Decisions ({missingSubmissions.length})
        </h2>
        <DataTable
          value={missingSubmissions}
          emptyMessage="No missing decisions"
          loading={isLoading}
          dataKey="_id"
          paginator
          rows={rows}
          first={first}
          totalRecords={missingSubmissions.length}
          onPage={onPage}
          rowsPerPageOptions={[5, 10, 20, 50]}
          onRowClick={(e) => {
            const student = e.data as MissingSubmission;
            if (student._id) {
              navigate(`/students/${student._id}`);
            }
          }}
          selectionMode="single"
        >
          <Column
            header="Student"
            body={(rowData: MissingSubmission) => (
              <div>
                <div className="font-medium">
                  {rowData.firstName} {rowData.lastName}
                </div>
              </div>
            )}
            sortable
            sortField="firstName"
          />
          <Column
            header="Profile Name"
            body={(rowData: MissingSubmission) => rowData.profile?.shopName || "—"}
            sortable
            sortField="profile.shopName"
          />
          <Column
            header="Student ID"
            body={(rowData: MissingSubmission) => rowData.profile?.studentId || "—"}
            sortable
            sortField="profile.studentId"
          />
        </DataTable>
      </div>
    </div>
  );
};

export default MissingScenarioSubmissionsList;
