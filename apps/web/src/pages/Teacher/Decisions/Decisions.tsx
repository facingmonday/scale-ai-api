import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import decisionService from "../../../services/decision";
import challengeService from "../../../services/challenge";
import enrollmentService from "../../../services/enrollment";
import profileTypeService from "../../../services/profileType";
import LoadingOverlay from "../../../components/LoadingOverlay";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { AutoComplete } from "primereact/autocomplete";
import { Dropdown } from "primereact/dropdown";
import type {
  SubmissionWithMember,
} from "../../../types/decision";
import type { Challenge } from "../../../types/challenge";
import type { Member } from "../../../types/member";
import type { ProfileType } from "../../../types/profileType";
import ExportDialog from "../../../components/ExportDialog";
import { getDecisionGenerationMethodLabel } from "@/constants";

// Extended type to include processingStatus which is returned from the API
type SubmissionWithProcessingStatus = SubmissionWithMember & {
  processingStatus?: string;
  profile?: {
    shopName?: string;
    studentId?: string;
    profileType?: string;
  };
  ledger?: {
    metrics?: Record<string, unknown>;
  };
  generation?: {
    method?: string;
  };
  challenge?: {
    title?: string;
    _id?: string;
  };
};

const statusBadgeClass: Record<string, string> = {
  completed: "badge-success",
  success: "badge-success",
  pending: "badge-warning",
  running: "badge-info",
  processing: "badge-info",
  failed: "badge-danger",
  error: "badge-danger",
};

const statusOptions = [
  { label: "All Statuses", value: "" },
  { label: "Completed", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Failed", value: "failed" },
];


const Decisions: React.FC = () => {
  const { activeClassroom } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [decisions, setSubmissions] = useState<
    SubmissionWithProcessingStatus[]
  >([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(25);

  const [processingStatusFilter, setProcessingStatusFilter] = useState<string>("");
  const [storeTypeFilter, setStoreTypeFilter] = useState<string>("");
  
  // Autocomplete filters (only updated when item is selected)
  const [selectedScenario, setSelectedScenario] = useState<Challenge | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Member | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  
  // Input text state (what user types in the autocomplete)
  const [scenarioInputText, setScenarioInputText] = useState<string>("");
  const [studentInputText, setStudentInputText] = useState<string>("");
  const [studentIdInputText, setStudentIdInputText] = useState<string>("");
  
  // Loading states for autocompletes
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingStudentIds, setIsLoadingStudentIds] = useState(false);
  
  // Autocomplete options
  const [challenges, setScenarios] = useState<Challenge[]>([]);
  const [filteredScenarios, setFilteredScenarios] = useState<Challenge[]>([]);
  const [students, setStudents] = useState<Member[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Member[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [filteredStudentIds, setFilteredStudentIds] = useState<string[]>([]);
  
  // Profile type options
  const [storeTypeOptions, setStoreTypeOptions] = useState<Array<{ label: string; value: string }>>([
    { label: "All Profile Types", value: "" },
  ]);
  
  // Sorting state
  const [sortField, setSortField] = useState<string>("submittedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Helper functions to create "All" options
  const getAllScenariosOption = (): Challenge => ({
    _id: "__all__",
    title: "All Challenges",
  } as Challenge);

  const getAllStudentsOption = (): Member => ({
    _id: "__all__",
    clerkUserId: "__all__",
    firstName: "All",
    lastName: "Students",
    maskedEmail: "",
  } as Member);

  const fetchSubmissions = useCallback(
    async (silent = false) => {
      if (!activeClassroom?._id) return;
  
      if (!silent) setIsLoading(true);
      setError(null);
  
      try {
        const page = Math.floor(first / rows);
        
        // Build filters array
        const filters: Array<{ field: string; operator: string; value: unknown }> = [];
        
        // Challenge filter
        if (selectedScenario) {
          const challengeId = selectedScenario._id || (selectedScenario as Challenge & { id?: string }).id;
          if (challengeId) {
            filters.push({ field: "challengeId", operator: "eq", value: challengeId });
          }
        }
        
        // Student filter (by member ID)
        if (selectedStudent?._id) {
          filters.push({ field: "userId", operator: "eq", value: selectedStudent._id });
        }
        
        // Student ID filter
        if (selectedStudentId) {
          filters.push({ field: "studentId", operator: "contains", value: selectedStudentId });
        }
        
        // Processing status filter (only if value is a non-empty string)
        if (processingStatusFilter && typeof processingStatusFilter === "string" && processingStatusFilter.trim() !== "") {
          filters.push({ field: "processingStatus", operator: "eq", value: processingStatusFilter });
        }
        
        // Profile type filter (only if value is a non-empty string)
        if (storeTypeFilter && typeof storeTypeFilter === "string" && storeTypeFilter.trim() !== "") {
          filters.push({ field: "profile.profileType", operator: "eq", value: storeTypeFilter });
        }
        
        let backendSortField = sortField;
        if (sortField === "name") backendSortField = "member.firstName";

        const response = await decisionService.search({
          classroomId: activeClassroom._id,
          page,
          pageSize: rows,
          sortField: backendSortField || "submittedAt",
          sortDirection: sortOrder || "desc",
          filters,
          includeJobs: false,
        });

        const responseData = response.data || [];
        const total = response.total || 0;

        setSubmissions(responseData as SubmissionWithProcessingStatus[]);
        setTotalRecords(total);
      } catch (err) {
        console.error("Failed to fetch decisions:", err);
        if (!silent) setError("Failed to load decisions");
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [activeClassroom, first, rows, selectedScenario, selectedStudent, selectedStudentId, processingStatusFilter, storeTypeFilter, sortField, sortOrder]
  );

  // Fetch challenges for autocomplete
  useEffect(() => {
    const fetchAutocompleteData = async () => {
      if (!activeClassroom?._id) return;

      try {
        // Fetch challenges
        const scenariosResponse = await challengeService.getAll(activeClassroom._id, "admin");
        const scenariosList = (scenariosResponse?.data ?? scenariosResponse ?? []) as Challenge[];
        const validScenarios = Array.isArray(scenariosList) ? scenariosList : [];
        setScenarios(validScenarios);
        // Initialize filtered challenges with "All Challenges" option first, then all challenges
        setFilteredScenarios([getAllScenariosOption(), ...validScenarios]);
      } catch (err) {
        console.error("Failed to fetch autocomplete data:", err);
        setScenarios([]);
        setFilteredScenarios([]);
      }
    };

    void fetchAutocompleteData();
  }, [activeClassroom?._id]);

  // Pre-select challenge from URL parameter (only on initial load)
  const hasInitializedFromUrl = useRef(false);
  useEffect(() => {
    const scenarioIdFromUrl = searchParams.get("challengeId");
    if (scenarioIdFromUrl && challenges.length > 0 && !hasInitializedFromUrl.current) {
      // Find the challenge matching the ID from URL
      const scenarioToSelect = challenges.find(
        (s) => s._id === scenarioIdFromUrl || (s as Challenge & { id?: string }).id === scenarioIdFromUrl
      );
      if (scenarioToSelect) {
        setSelectedScenario(scenarioToSelect);
        setScenarioInputText(scenarioToSelect.title || "");
        hasInitializedFromUrl.current = true;
      }
    }
  }, [challenges, searchParams]);

  // Fetch student roster data for autocomplete filters
  useEffect(() => {
    const fetchRosterData = async () => {
      if (!activeClassroom?._id) return;

      try {
        // Fetch all students from roster
        const rosterResponse = await enrollmentService.getRoster(
          activeClassroom._id,
          0,
          1000, // Large page size to get all students
          "",
          "name",
          "asc"
        );

        const rosterData = rosterResponse?.data ?? rosterResponse ?? [];
        const rosterList = Array.isArray(rosterData) ? rosterData : [];

        // Extract unique student IDs from roster
        const uniqueStudentIds = Array.from(
          new Set(
            rosterList
              .map((student: Record<string, unknown>) => 
                (student.profile as { studentId?: string })?.studentId
              )
              .filter((id): id is string => Boolean(id))
          )
        ).sort();
        
        setStudentIds(uniqueStudentIds);
        // Initialize with "All Student IDs" option first
        setFilteredStudentIds(["__all__", ...uniqueStudentIds]);

        // Transform roster data to Member format
        const membersFromRoster: Member[] = rosterList
          .map((student: Record<string, unknown>) => {
            const userId = 
              (student.userId as string) || 
              (student.user_id as string) || 
              (student._id as string) || 
              "";
            
            if (!userId) return null;

            return {
              _id: userId,
              clerkUserId: userId,
              firstName: (student.firstName as string) || "",
              lastName: (student.lastName as string) || "",
              maskedEmail: (student.email as string) || "",
            } as Member;
          })
          .filter((m): m is Member => Boolean(m));

        if (membersFromRoster.length > 0) {
          setStudents(membersFromRoster);
          // Initialize with "All Students" option first
          setFilteredStudents([getAllStudentsOption(), ...membersFromRoster]);
        }
      } catch (err) {
        console.error("Failed to fetch roster data:", err);
        // Set empty arrays on error
        setStudentIds([]);
        setFilteredStudentIds([]);
        setStudents([]);
        setFilteredStudents([]);
      }
    };

    void fetchRosterData();
  }, [activeClassroom?._id]);

  // Fetch profile types for filter dropdown
  useEffect(() => {
    const fetchStoreTypes = async () => {
      if (!activeClassroom?._id) return;

      try {
        const storeTypesResponse = await profileTypeService.getAll("admin", {
          classroomId: activeClassroom._id,
        });
        const storeTypesList = (storeTypesResponse?.data ?? storeTypesResponse ?? []) as ProfileType[];
        const validStoreTypes = Array.isArray(storeTypesList) ? storeTypesList : [];

        // Transform profile types into dropdown options, using _id as value
        const options = [
          { label: "All Profile Types", value: "" },
          ...validStoreTypes.map((profileType) => ({
            label: profileType.label || profileType.key || "",
            value: profileType._id || "",
          })).filter((option) => option.value && option.label), // Filter out invalid options
        ];

        setStoreTypeOptions(options);
      } catch (err) {
        console.error("Failed to fetch profile types:", err);
        // Keep the default "All Profile Types" option on error
        setStoreTypeOptions([{ label: "All Profile Types", value: "" }]);
      }
    };

    void fetchStoreTypes();
  }, [activeClassroom?._id]);

  // Track previous filter values to detect filter changes (not pagination changes)
  const prevFiltersRef = useRef<{
    selectedScenario: Challenge | null;
    selectedStudent: Member | null;
    selectedStudentId: string;
    processingStatusFilter: string;
    storeTypeFilter: string;
    sortField: string;
    sortOrder: "asc" | "desc";
  } | null>(null);

  // Reset pagination when filters/sort change (but not on initial mount or pagination changes)
  useEffect(() => {
    if (prevFiltersRef.current === null) {
      // Initial mount - initialize ref and don't reset pagination
      prevFiltersRef.current = {
        selectedScenario,
        selectedStudent,
        selectedStudentId,
        processingStatusFilter,
        storeTypeFilter,
        sortField,
        sortOrder,
      };
      return;
    }

    // Check if filters/sort changed
    const filtersChanged = 
      prevFiltersRef.current.selectedScenario !== selectedScenario ||
      prevFiltersRef.current.selectedStudent !== selectedStudent ||
      prevFiltersRef.current.selectedStudentId !== selectedStudentId ||
      prevFiltersRef.current.processingStatusFilter !== processingStatusFilter ||
      prevFiltersRef.current.storeTypeFilter !== storeTypeFilter ||
      prevFiltersRef.current.sortField !== sortField ||
      prevFiltersRef.current.sortOrder !== sortOrder;

    if (filtersChanged) {
      setFirst(0);
      // Update ref
      prevFiltersRef.current = {
        selectedScenario,
        selectedStudent,
        selectedStudentId,
        processingStatusFilter,
        storeTypeFilter,
        sortField,
        sortOrder,
      };
    }
  }, [selectedScenario, selectedStudent, selectedStudentId, processingStatusFilter, storeTypeFilter, sortField, sortOrder]);

  // Fetch decisions when filters, pagination, or sort change
  useEffect(() => {
    if (!activeClassroom?._id) return;
    void fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassroom, first, rows, selectedScenario, selectedStudent, selectedStudentId, processingStatusFilter, storeTypeFilter, sortField, sortOrder]);

  const handleExport = async () => {
    // Export functionality removed since it requires challengeId
    // This would need to be adapted if export is needed for all classroom decisions
    throw new Error("Export not available for classroom-level decisions");
  };

  const onPage = (e: { first: number; rows: number }) => {
    setFirst(e.first);
    setRows(e.rows);
  };

  const onSort = (e: {
    sortField?: string;
    sortOrder?: 0 | 1 | -1 | null;
  }) => {
    setSortField(e.sortField || "");
    if (e.sortOrder === 1) {
      setSortOrder("asc");
    } else if (e.sortOrder === -1) {
      setSortOrder("desc");
    } else {
      setSortOrder("desc");
    }
  };

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    selectedScenario ||
    selectedStudent ||
    selectedStudentId ||
    processingStatusFilter ||
    storeTypeFilter
  );

  // Debounce timers for autocomplete searches
  const scenarioSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studentSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studentIdSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete search handlers with debouncing
  const searchScenarios = useCallback((event: { query: string }) => {
    if (scenarioSearchTimerRef.current) {
      clearTimeout(scenarioSearchTimerRef.current);
    }

    // Set loading immediately when user types
    setIsLoadingScenarios(true);

    scenarioSearchTimerRef.current = setTimeout(() => {
      const query = event.query.toLowerCase().trim();
      const allOption = getAllScenariosOption();
      
      if (query === "") {
        // Show "All Challenges" option first, then all challenges
        setFilteredScenarios([allOption, ...challenges]);
      } else {
        // Filter challenges, but always include "All Challenges" if it matches
        const filtered = challenges.filter((challenge) =>
          challenge.title.toLowerCase().includes(query)
        );
        const shouldIncludeAll = "all challenges".includes(query);
        setFilteredScenarios(shouldIncludeAll ? [allOption, ...filtered] : filtered);
      }
      setIsLoadingScenarios(false);
    }, 150); // Reduced debounce for better responsiveness
  }, [challenges]);

  const searchStudents = useCallback((event: { query: string }) => {
    if (studentSearchTimerRef.current) {
      clearTimeout(studentSearchTimerRef.current);
    }

    // Set loading immediately when user types
    setIsLoadingStudents(true);

    studentSearchTimerRef.current = setTimeout(() => {
      const query = event.query.trim().toLowerCase();
      const allOption = getAllStudentsOption();
      
      if (query === "") {
        // Show "All Students" option first, then all students
        setFilteredStudents([allOption, ...students]);
      } else {
        // Filter students locally from roster data
        const filtered = students.filter((student) => {
          const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim().toLowerCase();
          const firstName = (student.firstName || "").toLowerCase();
          const lastName = (student.lastName || "").toLowerCase();
          return (
            fullName.includes(query) ||
            firstName.includes(query) ||
            lastName.includes(query)
          );
        });
        // Always include "All Students" if query matches
        const shouldIncludeAll = "all students".includes(query);
        setFilteredStudents(shouldIncludeAll ? [allOption, ...filtered] : filtered);
      }
      setIsLoadingStudents(false);
    }, 150); // Reduced debounce for better responsiveness
  }, [students]);

  const searchStudentIds = useCallback((event: { query: string }) => {
    if (studentIdSearchTimerRef.current) {
      clearTimeout(studentIdSearchTimerRef.current);
    }

    // Set loading immediately when user types
    setIsLoadingStudentIds(true);

    studentIdSearchTimerRef.current = setTimeout(() => {
      const query = event.query.toLowerCase().trim();
      const allOption = "__all__";
      
      if (query === "") {
        // Show "All Student IDs" option first, then all student IDs
        setFilteredStudentIds([allOption, ...studentIds]);
      } else {
        // Filter student IDs
        const filtered = studentIds.filter((id) =>
          id.toLowerCase().includes(query)
        );
        // Always include "All Student IDs" if query matches
        const shouldIncludeAll = "all student ids".includes(query) || "all student id".includes(query);
        setFilteredStudentIds(shouldIncludeAll ? [allOption, ...filtered] : filtered);
      }
      setIsLoadingStudentIds(false);
    }, 150); // Reduced debounce for better responsiveness
  }, [studentIds]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (scenarioSearchTimerRef.current) {
        clearTimeout(scenarioSearchTimerRef.current);
      }
      if (studentSearchTimerRef.current) {
        clearTimeout(studentSearchTimerRef.current);
      }
      if (studentIdSearchTimerRef.current) {
        clearTimeout(studentIdSearchTimerRef.current);
      }
    };
  }, []);


  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <h1 className="heading-xl mb-6">Decisions</h1>
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={() => void fetchSubmissions()} className="btn-teal">
                Try Again
              </button>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  return (
    <BasicLayout>
      <LoadingOverlay loading={isLoading} />
      <div className="page">
        <div className="container">
          <h1 className="heading-xl mb-6">
            Decisions ({totalRecords})
          </h1>

          {decisions.length === 0 && !isLoading && !hasActiveFilters ? (
            <div className="card text-center py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="heading-lg mb-2">No Decisions Yet</h2>
              <p className="text-text-muted">
                There are no decisions for this class yet. Students haven't
                submitted any work yet.
              </p>
            </div>
          ) :(
            <div className="space-y-6">
              {/* Filters */}
              <div className="card">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label
                        htmlFor="challenge-filter"
                        className="block text-sm font-medium mb-2"
                      >
                        Challenge
                      </label>
                      <AutoComplete
                        id="challenge-filter"
                        value={scenarioInputText}
                        suggestions={
                          isLoadingScenarios
                            ? ([{ _id: "__loading__", title: "" }] as Challenge[])
                            : filteredScenarios
                        }
                        completeMethod={searchScenarios}
                        onChange={(e) => {
                          // Update input text as user types
                          const newValue = e.value;
                          if (typeof newValue === "string") {
                            setScenarioInputText(newValue);
                            // Clear selection if user is typing
                            if (selectedScenario) {
                              setSelectedScenario(null);
                            }
                          } else if (newValue === null) {
                            setScenarioInputText("");
                            setSelectedScenario(null);
                          }
                        }}
                        onSelect={(e) => {
                          // Prevent selection of loading item
                          const selected = e.value as Challenge;
                          if (selected?._id === "__loading__") {
                            return;
                          }
                          // Handle "All Challenges" option
                          if (selected?._id === "__all__") {
                            setSelectedScenario(null);
                            setScenarioInputText("");
                            return;
                          }
                          // Update both selected value and input text when item is selected
                          setSelectedScenario(selected);
                          setScenarioInputText(selected?.title || "");
                        }}
                        onFocus={() => {
                          // Show "All Challenges" option first, then all challenges when dropdown is opened
                          if (filteredScenarios.length === 0 && challenges.length > 0) {
                            setFilteredScenarios([getAllScenariosOption(), ...challenges]);
                          } else if (filteredScenarios.length > 0 && filteredScenarios[0]?._id !== "__all__") {
                            // Ensure "All Challenges" is at the top if not already there
                            setFilteredScenarios([getAllScenariosOption(), ...filteredScenarios]);
                          }
                        }}
                        field="title"
                        placeholder="Search by challenge..."
                        className="w-full"
                        dropdown
                        forceSelection={false}
                        itemTemplate={(challenge) => {
                          if (challenge?._id === "__loading__") {
                            return (
                              <div className="flex items-center justify-center py-8 px-4">
                                <div
                                  className="rounded-full animate-spin border-2 border-ui-border border-t-brand-teal"
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    borderTopColor: "var(--color-brand-teal)",
                                    boxSizing: "border-box",
                                    aspectRatio: "1 / 1",
                                  }}
                                  aria-label="Loading"
                                />
                              </div>
                            );
                          }
                          // Style "All Challenges" option differently
                          if (challenge?._id === "__all__") {
                            return <div className="font-medium text-brand-teal">{challenge?.title || ""}</div>;
                          }
                          return <div>{challenge?.title || ""}</div>;
                        }}
                        emptyMessage="No challenges found"
                        panelClassName="p-autocomplete-panel"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label
                        htmlFor="student-filter"
                        className="block text-sm font-medium mb-2"
                      >
                        Student
                      </label>
                      <AutoComplete
                        id="student-filter"
                        value={studentInputText}
                        suggestions={
                          isLoadingStudents
                            ? ([{ _id: "__loading__", firstName: "", lastName: "" }] as Member[])
                            : filteredStudents
                        }
                        completeMethod={searchStudents}
                        onChange={(e) => {
                          // Update input text as user types
                          const newValue = e.value;
                          if (typeof newValue === "string") {
                            setStudentInputText(newValue);
                            // Clear selection if user is typing
                            if (selectedStudent) {
                              setSelectedStudent(null);
                            }
                          } else if (newValue === null) {
                            setStudentInputText("");
                            setSelectedStudent(null);
                          }
                        }}
                        onSelect={(e) => {
                          // Prevent selection of loading item
                          const selected = e.value as Member;
                          if (selected?._id === "__loading__") {
                            return;
                          }
                          // Handle "All Students" option
                          if (selected?._id === "__all__") {
                            setSelectedStudent(null);
                            setStudentInputText("");
                            return;
                          }
                          // Update both selected value and input text when item is selected
                          setSelectedStudent(selected);
                          const fullName = `${selected?.firstName || ""} ${selected?.lastName || ""}`.trim();
                          setStudentInputText(fullName || "");
                        }}
                        onFocus={() => {
                          // Show "All Students" option first, then all students when dropdown is opened
                          if (filteredStudents.length === 0 && students.length > 0) {
                            setFilteredStudents([getAllStudentsOption(), ...students]);
                          } else if (filteredStudents.length > 0 && filteredStudents[0]?._id !== "__all__") {
                            // Ensure "All Students" is at the top if not already there
                            setFilteredStudents([getAllStudentsOption(), ...filteredStudents]);
                          }
                        }}
                        onDropdownClick={() => {
                          // Show "All Students" option first, then all students when dropdown button is clicked
                          if (students.length > 0) {
                            setFilteredStudents([getAllStudentsOption(), ...students]);
                          }
                        }}
                        itemTemplate={(student) => {
                          if (student?._id === "__loading__") {
                            return (
                              <div className="flex items-center justify-center py-8 px-4">
                                <div
                                  className="rounded-full animate-spin border-2 border-ui-border border-t-brand-teal"
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    borderTopColor: "var(--color-brand-teal)",
                                    boxSizing: "border-box",
                                    aspectRatio: "1 / 1",
                                  }}
                                  aria-label="Loading"
                                />
                              </div>
                            );
                          }
                          // Style "All Students" option differently
                          if (student?._id === "__all__") {
                            const fullName = `${student?.firstName || ""} ${student?.lastName || ""}`.trim();
                            return <div className="font-medium text-brand-teal">{fullName || "—"}</div>;
                          }
                          const firstName = student?.firstName || "";
                          const lastName = student?.lastName || "";
                          const fullName = `${firstName} ${lastName}`.trim();
                          return <div>{fullName || "—"}</div>;
                        }}
                        selectedItemTemplate={(student) => {
                          if (!student) return "";
                          const firstName = student.firstName || "";
                          const lastName = student.lastName || "";
                          return `${firstName} ${lastName}`.trim() || "—";
                        }}
                        emptyMessage="No students found"
                        placeholder="Search by student name..."
                        className="w-full"
                        dropdown
                        forceSelection={false}
                        panelClassName="p-autocomplete-panel"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label
                        htmlFor="student-id-filter"
                        className="block text-sm font-medium mb-2"
                      >
                        Student ID
                      </label>
                      <AutoComplete
                        id="student-id-filter"
                        value={studentIdInputText}
                        suggestions={
                          isLoadingStudentIds ? ["__loading__"] : filteredStudentIds
                        }
                        completeMethod={searchStudentIds}
                        onChange={(e) => {
                          // Update input text as user types
                          const newValue = e.value;
                          if (typeof newValue === "string") {
                            setStudentIdInputText(newValue);
                            // Clear selection if user is typing
                            if (selectedStudentId) {
                              setSelectedStudentId("");
                            }
                          } else if (newValue === null) {
                            setStudentIdInputText("");
                            setSelectedStudentId("");
                          }
                        }}
                        onSelect={(e) => {
                          // Prevent selection of loading item
                          const selected = e.value as string;
                          if (selected === "__loading__") {
                            return;
                          }
                          // Handle "All Student IDs" option
                          if (selected === "__all__") {
                            setSelectedStudentId("");
                            setStudentIdInputText("");
                            return;
                          }
                          // Update both selected value and input text when item is selected
                          setSelectedStudentId(selected);
                          setStudentIdInputText(selected || "");
                        }}
                        onFocus={() => {
                          // Show "All Student IDs" option first, then all student IDs when dropdown is opened
                          if (filteredStudentIds.length === 0 && studentIds.length > 0) {
                            setFilteredStudentIds(["__all__", ...studentIds]);
                          } else if (filteredStudentIds.length > 0 && filteredStudentIds[0] !== "__all__") {
                            // Ensure "All Student IDs" is at the top if not already there
                            setFilteredStudentIds(["__all__", ...filteredStudentIds]);
                          }
                        }}
                        placeholder="Search by student ID..."
                        className="w-full"
                        dropdown
                        forceSelection={false}
                        itemTemplate={(studentId) => {
                          if (studentId === "__loading__") {
                            return (
                              <div className="flex items-center justify-center py-8 px-4">
                                <div
                                  className="rounded-full animate-spin border-2 border-ui-border border-t-brand-teal"
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    borderTopColor: "var(--color-brand-teal)",
                                    boxSizing: "border-box",
                                    aspectRatio: "1 / 1",
                                  }}
                                  aria-label="Loading"
                                />
                              </div>
                            );
                          }
                          // Style "All Student IDs" option differently
                          if (studentId === "__all__") {
                            return <div className="font-medium text-brand-teal">All Student IDs</div>;
                          }
                          return <div>{studentId || ""}</div>;
                        }}
                        emptyMessage="No student IDs found"
                        panelClassName="p-autocomplete-panel"
                      />
                    </div>
                    <div className="min-w-[200px]">
                      <label
                        htmlFor="profile-type-filter"
                        className="block text-sm font-medium mb-2"
                      >
                        Profile Type
                      </label>
                      <Dropdown
                        id="profile-type-filter"
                        value={storeTypeFilter}
                        options={storeTypeOptions}
                        onChange={(e) => {
                          // Extract the value from the option object if it's an object, otherwise use the value directly
                          const selectedValue = typeof e.value === "object" && e.value !== null && "value" in e.value
                            ? e.value.value
                            : e.value;
                          setStoreTypeFilter(selectedValue || "");
                        }}
                        placeholder="Filter by profile type"
                        className="w-full"
                      />
                    </div>
                    <div className="min-w-[200px]">
                      <label
                        htmlFor="status-filter"
                        className="block text-sm font-medium mb-2"
                      >
                        Status
                      </label>
                      <Dropdown
                        id="status-filter"
                        value={processingStatusFilter}
                        options={statusOptions}
                        onChange={(e) => {
                          // Extract the value from the option object if it's an object, otherwise use the value directly
                          const selectedValue = typeof e.value === "object" && e.value !== null && "value" in e.value
                            ? e.value.value
                            : e.value;
                          setProcessingStatusFilter(selectedValue || "");
                        }}
                        placeholder="Filter by status"
                        className="w-full"
                      />
                    </div>
                  </div>
                  {(selectedScenario || selectedStudent || selectedStudentId) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-text-muted">Active filters:</span>
                      {selectedScenario && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedScenario(null);
                            setScenarioInputText("");
                          }}
                          className="badge badge-info flex items-center gap-1"
                        >
                          Challenge: {selectedScenario.title}
                          <i className="pi pi-times text-xs" />
                        </button>
                      )}
                      {selectedStudent && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(null);
                            setStudentInputText("");
                          }}
                          className="badge badge-info flex items-center gap-1"
                        >
                          Student: {`${selectedStudent.firstName || ""} ${selectedStudent.lastName || ""}`.trim()}
                          <i className="pi pi-times text-xs" />
                        </button>
                      )}
                      {selectedStudentId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentId("");
                            setStudentIdInputText("");
                          }}
                          className="badge badge-info flex items-center gap-1"
                        >
                          Student ID: {selectedStudentId}
                          <i className="pi pi-times text-xs" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Decisions DataTable */}
              <>
              {decisions.length === 0 && !isLoading && hasActiveFilters ? (
            <div className="card text-center py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h2 className="heading-lg mb-2">No Results Found</h2>
              <p className="text-text-muted">
                No decisions match your current filters. Try adjusting your search criteria.
              </p>
            </div>
          ) : (
            <DataTable
                  value={decisions}
                  emptyMessage="No decisions found"
                  loading={isLoading}
                  dataKey="_id"
                  onRowClick={(e) => {
                    const row = e.data as { _rowType?: string; _id: string };
                    if (row._rowType !== "submitted") return; // missing row
                    navigate(`/decisions/${row._id}`);
                  }}
                  selectionMode="single"
                  lazy
                  paginator
                  rows={rows}
                  first={first}
                  totalRecords={totalRecords}
                  onPage={onPage}
                  onSort={onSort}
                  sortField={sortField}
                  sortOrder={sortOrder === "asc" ? 1 : sortOrder === "desc" ? -1 : null}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  header={
                    <div className="flex flex-row justify-between items-center flex-wrap gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="heading-md">
                          Decisions ({totalRecords})
                        </h2>
                      </div>
                      <div className="flex gap-2">
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
                        {/* Export disabled since it requires challengeId */}
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
                          <i className={icon || "pi"} aria-label={tooltip} />
                        </span>
                      );
                    }}
                  />
                  <Column
                    header="Name"
                    sortable
                    sortField="name"
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
                    body={(r) => r.profile?.shopName || "—"}
                  />
                  <Column
                    header="Student ID"
                    sortable
                    sortField="profile.studentId"
                    body={(r) => r.profile?.studentId || "—"}
                  />
                  <Column
                    header="Challenge"
                    body={(r) => r.challenge?.title || "—"}
                  />
                  <Column
                    field="processingStatus"
                    header="Processing Status"
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
                    sortable
                    sortField="processingStatus"
                  />
                </DataTable>
                )}
              </>
            </div>
          )}
        </div>
      </div>

      <ExportDialog
        visible={showExportDialog}
        onHide={() => setShowExportDialog(false)}
        onExport={handleExport}
        exportName="decisions"
      />
    </BasicLayout>
  );
};

export default Decisions;
