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
        name: "Challenges",
        key: "challenges",
        route: "/challenges",
        pageKey: "challenges",
        icon: "layers",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Challenge",
        key: "challenge",
        route: "/challenges/:id",
        pageKey: "challenge",
        icon: "description",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Ledger Entries",
        key: "ledgerEntries",
        route: "/challenges/:challengeId/ledger-entries",
        pageKey: "ledgerEntries",
        icon: "receipt",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "Ledger Entry",
        key: "ledgerEntry",
        route: "/challenges/:challengeId/ledger-entries/:ledgerEntryId",
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
        name: "Profile",
        key: "profile",
        route: "/profile",
        pageKey: "profile",
        icon: "profile",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "AI Coach",
        key: "aiCoach",
        route: "/ai-coach",
        pageKey: "aiCoach",
        icon: "chat",
      }
    ),

    classroomRequired(
      !isOrgAdmin && {
        type: "item",
        name: "File Vault",
        key: "vault",
        route: "/vault",
        pageKey: "vault",
        icon: "folder",
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
        name: "Profile Types",
        key: "profileTypes",
        route: "/profile-types",
        pageKey: "profileTypes",
        icon: "profile",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Profile Type",
        key: "profileType",
        route: "/profile-types/:id",
        pageKey: "profileType",
        icon: "profile",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Challenges",
        key: "challenges",
        route: "/challenges",
        pageKey: "challenges",
        icon: "layers",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Challenge",
        key: "challenge",
        route: "/challenges/:id",
        pageKey: "challenge",
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
        name: "AI Assistant",
        key: "aiCoach",
        route: "/ai-coach",
        pageKey: "aiCoach",
        icon: "chat",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Classroom Vault",
        key: "vault",
        route: "/vault",
        pageKey: "vault",
        icon: "folder",
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
        name: "Decisions",
        key: "decisions",
        route: "/decisions",
        pageKey: "decisions",
        icon: "assignment",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Decision",
        key: "decision",
        route: "/decisions/:id",
        pageKey: "decision",
        icon: "assignment_turned_in",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Ledger Entries",
        key: "ledgerEntries",
        route: "/challenges/:challengeId/ledger-entries",
        pageKey: "ledgerEntries",
        icon: "receipt",
      }
    ),

    classroomRequired(
      isOrgAdmin && {
        type: "item",
        name: "Ledger Entry",
        key: "ledgerEntry",
        route: "/challenges/:challengeId/ledger-entries/:ledgerEntryId",
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
