const getUsersRoutes = ({
  activeClassroom,
  orgRole = "org:member",
  classroomRole = null,
}) => {
  // Organization-level roles
  const isOrgAdmin = orgRole === "org:admin";

  const classroomRequired = (route) => activeClassroom && route;

  return [
    {
      type: "title",
      title: "SCALE.ai",
      key: "title",
    },

    {
      type: "item",
      name: "Classrooms",
      key: "classrooms",
      route: "/classrooms",
      pageKey: "classrooms",
      icon: "school",
    },

    // ================= CLASSROOM STUDENT =================
    // Show student routes when user is not an org admin
    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Dashboard",
        key: "dashboard",
        route: "/dashboard",
        pageKey: "dashboard",
        icon: "dashboard",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Scenarios",
        key: "scenarios",
        route: "/scenarios",
        pageKey: "scenarios",
        icon: "layers",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Scenario",
        key: "scenario",
        route: "/scenarios/:id",
        pageKey: "scenario",
        icon: "description",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Ledger Entries",
        key: "ledgerEntries",
        route: "/scenarios/:scenarioId/ledger-entries",
        pageKey: "ledgerEntries",
        icon: "receipt",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Ledger Entry",
        key: "ledgerEntry",
        route: "/scenarios/:scenarioId/ledger-entries/:ledgerEntryId",
        pageKey: "ledgerEntry",
        icon: "receipt",
      }
    ),
    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Settings",
        key: "settings",
        route: "/settings",
        pageKey: "settings",
        icon: "settings",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Store",
        key: "store",
        route: "/store",
        pageKey: "store",
        icon: "store",
      }
    ),

    // ================= CLASSROOM TEACHER =================
    // Show teacher routes when user is an org admin
    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Dashboard",
        key: "dashboard",
        route: "/dashboard",
        pageKey: "dashboard",
        icon: "dashboard",
      }
    ),
    {
      type: "item",
      name: "Classroom",
      key: "classroom",
      route: "/classrooms/:id",
      pageKey: "classroom",
      icon: "school",
    },

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Store Types",
        key: "storeTypes",
        route: "/store-types",
        pageKey: "storeTypes",
        icon: "store",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Store Type",
        key: "storeType",
        route: "/store-types/:id",
        pageKey: "storeType",
        icon: "store",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Scenarios",
        key: "scenarios",
        route: "/scenarios",
        pageKey: "scenarios",
        icon: "layers",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Scenario",
        key: "scenario",
        route: "/scenarios/:id",
        pageKey: "scenario",
        icon: "description",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Settings",
        key: "settings",
        route: "/settings",
        pageKey: "settings",
        icon: "settings",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Students",
        key: "students",
        route: "/students",
        pageKey: "students",
        icon: "group",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Student",
        key: "student",
        route: "/students/:id",
        pageKey: "student",
        icon: "person",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Submissions",
        key: "submissions",
        route: "/submissions",
        pageKey: "submissions",
        icon: "assignment",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Submission",
        key: "submission",
        route: "/submissions/:id",
        pageKey: "submission",
        icon: "assignment_turned_in",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Ledger Entries",
        key: "ledgerEntries",
        route: "/scenarios/:scenarioId/ledger-entries",
        pageKey: "ledgerEntries",
        icon: "receipt",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Ledger Entry",
        key: "ledgerEntry",
        route: "/scenarios/:scenarioId/ledger-entries/:ledgerEntryId",
        pageKey: "ledgerEntry",
        icon: "receipt",
      }
    ),

    // Admin-only Job Monitoring Routes (visible only to org:admin)
    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Jobs",
        key: "jobs",
        route: "/jobs",
        pageKey: "jobs",
        icon: "precision_manufacturing",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Job Detail",
        key: "job",
        route: "/jobs/:jobId",
        pageKey: "job",
        icon: "assignment",
      }
    ),
  ].filter(Boolean);
};

module.exports = { getUsersRoutes };
