import React, { useEffect, useState, useCallback, useRef } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import enrollmentService from "../services/enrollment";
import type { StudentDisplay } from "../types/components";

interface StudentListProps {
  classroomId: string | null;
  onStudentClick?: (student: StudentDisplay) => void;
  onEdit?: (student: StudentDisplay) => void;
  onDelete?: (student: StudentDisplay) => void;
  onStudentsLoaded?: (students: StudentDisplay[], count: number) => void;
  emptyState?: React.ReactNode;
  pageSize?: number;
}

const StudentList: React.FC<StudentListProps> = ({
  classroomId,
  onStudentClick,
  onEdit,
  onDelete,
  onStudentsLoaded,
  emptyState,
  pageSize = 10,
}) => {
  const [students, setStudents] = useState<StudentDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [searchInput, setSearchInput] = useState(""); // Input value (immediate updates)
  const [searchTerm, setSearchTerm] = useState(""); // Debounced search term (used for API calls)
  
  // Sorting state
  const [sortField, setSortField] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Debounce timer ref for search
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!classroomId) {
      setStudents([]);
      setTotalRecords(0);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Server-side pagination.
      const page = Math.floor(first / currentPageSize);
      
      // Map DataTable sortField to backend sortBy values
      let backendSortBy = "name"; // default
      if (sortField === "lastName" || sortField === "name") {
        backendSortBy = "name";
      } else if (sortField === "email") {
        backendSortBy = "email";
      } else if (sortField === "profile.studentId" || sortField === "studentId") {
        backendSortBy = "studentId";
      } else if (sortField === "profile.shopName" || sortField === "shopName") {
        backendSortBy = "storeName";
      } else if (sortField === "createdAt" || sortField === "joinedAt") {
        backendSortBy = "joinedAt";
      }
      
      const response = await enrollmentService.getRoster(
        classroomId,
        page,
        currentPageSize,
        searchTerm,
        backendSortBy,
        sortOrder
      );

      // Handle paginated response structure
      const rosterData = response?.data ?? response ?? [];
      const total = response?.total || 0;

      // Transform roster data to StudentDisplay format
      const transformedStudents: StudentDisplay[] = Array.isArray(rosterData)
        ? rosterData.map((student: Record<string, unknown>) => {
            const firstName = (student.firstName as string) || "";
            const lastName = (student.lastName as string) || "";
            const userId =
              (student.userId as string) || (student.user_id as string) || "";
            const derivedId =
              userId || (student._id as string) || (student.id as string) || "";
            return {
              ...student,
              id: derivedId,
              userId: userId || undefined,
              lastName,
              firstName,
              name: `${firstName} ${lastName}`.trim() || "",
              email: (student.email as string) || "",
              classroomId: classroomId,
              createdAt:
                (student.createdAt as string) ||
                (student.created_at as string) ||
                "",
            };
          })
        : [];

      setStudents(transformedStudents);
      // If API doesn't include total, fall back to current page length.
      const resolvedTotal = total || transformedStudents.length;
      setTotalRecords(resolvedTotal);
      onStudentsLoaded?.(transformedStudents, resolvedTotal);
    } catch (err) {
      console.error("Failed to fetch students:", err);
      setError("Failed to load students");
    } finally {
      setIsLoading(false);
    }
  }, [classroomId, currentPageSize, first, searchTerm, sortField, sortOrder, onStudentsLoaded]);

  // Debounce search input updates
  useEffect(() => {
    // Clear existing timer
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    // Set new timer to update searchTerm after user stops typing
    searchDebounceTimerRef.current = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300); // 300ms debounce delay

    // Cleanup function
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, [searchInput]);

  // Track previous filter/sort values to detect changes (not pagination changes)
  const prevFiltersRef = useRef<{
    searchTerm: string;
    sortField: string;
    sortOrder: "asc" | "desc";
  } | null>(null);

  // Reset pagination when filters/sort change (but not on initial mount or pagination changes)
  useEffect(() => {
    if (prevFiltersRef.current === null) {
      // Initial mount - initialize ref and don't reset pagination
      prevFiltersRef.current = {
        searchTerm,
        sortField,
        sortOrder,
      };
      return;
    }

    // Check if filters/sort changed
    const filtersChanged =
      prevFiltersRef.current.searchTerm !== searchTerm ||
      prevFiltersRef.current.sortField !== sortField ||
      prevFiltersRef.current.sortOrder !== sortOrder;

    if (filtersChanged) {
      setFirst(0);
      // Update ref
      prevFiltersRef.current = {
        searchTerm,
        sortField,
        sortOrder,
      };
    }
  }, [searchTerm, sortField, sortOrder]);

  useEffect(() => {
    // Reset paging when switching classes.
    setFirst(0);
  }, [classroomId]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);
  const actionBodyTemplate = (rowData: StudentDisplay) => {
    return (
      <div className="flex gap-2">
        {onEdit && (
          <Button
            icon="pi pi-pencil"
            className="p-button-rounded p-button-text"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(rowData);
            }}
          />
        )}
        {onDelete && (
          <Button
            icon="pi pi-trash"
            className="p-button-rounded p-button-text p-button-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(rowData);
            }}
          />
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => void fetchStudents()} className="btn-teal">
          Try Again
        </button>
      </div>
    );
  }

  // Show custom empty state if provided and no students, but only when not searching
  if (!isLoading && students.length === 0 && emptyState && !searchTerm.trim()) {
    return <div className="w-full">{emptyState}</div>;
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search students by name or Student ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input"
        />
      </div>
      <DataTable
        className="w-full"
        value={students}
        onRowClick={(e) => onStudentClick?.(e.data as StudentDisplay)}
        selectionMode="single"
        dataKey="id"
        emptyMessage="No students found"
        loading={isLoading}
        scrollable
        scrollHeight="520px"
        paginator
        rows={currentPageSize}
        first={first}
        totalRecords={totalRecords}
        onPage={(e) => {
          setFirst(e.first ?? 0);
          setCurrentPageSize(e.rows || pageSize);
        }}
        lazy
        onSort={(e) => {
          setSortField(e.sortField || "name");
          if (e.sortOrder === 1) {
            setSortOrder("asc");
          } else if (e.sortOrder === -1) {
            setSortOrder("desc");
          } else {
            setSortOrder("asc");
          }
        }}
        sortField={sortField}
        sortOrder={sortOrder === "asc" ? 1 : sortOrder === "desc" ? -1 : null}
        rowsPerPageOptions={[5, 10, 20, 50]}
      >
        <Column
          field="imageUrl"
          header="Image"
          body={(rowData: StudentDisplay) =>
            rowData.profile?.imageUrl ? (
              <img
                src={rowData.profile?.imageUrl}
                alt="Student"
                className="w-[40px] h-[40px] rounded-full"
              />
            ) : (
              <i
                className="pi pi-user text-text-muted w-[40px] h-[40px] flex items-center justify-center"
                aria-hidden="true"
              />
            )
          }
        />
        <Column
          field="fullName"
          header="Name"
          sortable
          sortField="name"
          body={(rowData: StudentDisplay) =>
            [rowData.lastName, rowData.firstName].filter(Boolean).join(", ")
          }
        />
        <Column field="email" header="Email" sortable sortField="email" />
        <Column field="classroomId" header="Classroom" />
        <Column
          field="profile.studentId"
          header="Student ID"
          body={(rowData: StudentDisplay) =>
            rowData.profile?.studentId ? rowData.profile.studentId : "-"
          }
          sortable
          sortField="profile.studentId"
        />
        <Column
          field="profile.shopName"
          header="Profile Name"
          body={(rowData: StudentDisplay) =>
            rowData.profile?.shopName ? rowData.profile.shopName : "-"
          }
          sortable
          sortField="profile.shopName"
        />
        {(onEdit || onDelete) && (
          <Column body={actionBodyTemplate} header="Actions" />
        )}
      </DataTable>
    </div>
  );
};

export default StudentList;
