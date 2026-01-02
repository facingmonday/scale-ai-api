const getUsersRoutes = ({
  activeClassroom,
  orgRole = "org:member",
  classroomRole = null,
}) => {
  // Organization-level roles
  const isOrgAdmin = orgRole === "org:admin";
  const isOrgMember = orgRole === "org:member";

  // Classroom-level roles (when in an active classroom)
  const isClassroomTeacher = classroomRole === "admin";
  const isClassroomStudent = classroomRole === "member";

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
    // Show student routes when user is a student in the active classroom
    classroomRequired(
      isClassroomStudent && {
        type: "item",
        name: "Dashboard",
        key: "dashboard",
        route: "/dashboard",
        pageKey: "dashboard",
        icon: "dashboard",
      }
    ),

    classroomRequired(
      isClassroomStudent && {
        type: "item",
        name: "Scenarios",
        key: "scenarios",
        route: "/scenarios",
        pageKey: "scenarios",
        icon: "layers",
      }
    ),

    classroomRequired(
      isClassroomStudent && {
        type: "item",
        name: "Scenario",
        key: "scenario",
        route: "/scenarios/:id",
        pageKey: "scenario",
        icon: "description",
      }
    ),

    classroomRequired(
      isClassroomStudent && {
        type: "item",
        name: "Settings",
        key: "settings",
        route: "/settings",
        pageKey: "settings",
        icon: "settings",
      }
    ),

    classroomRequired(
      isClassroomStudent && {
        type: "item",
        name: "Store",
        key: "store",
        route: "/store",
        pageKey: "store",
        icon: "store",
      }
    ),

    // ================= CLASSROOM TEACHER =================
    // Show teacher routes when user is a teacher/admin in the active classroom
    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
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
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Store Types",
          key: "storeTypes",
          route: "/store-types",
          pageKey: "storeTypes",
          icon: "store",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Store Type",
          key: "storeType",
          route: "/store-types/:id",
          pageKey: "storeType",
          icon: "store",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Scenarios",
          key: "scenarios",
          route: "/scenarios",
          pageKey: "scenarios",
          icon: "layers",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Scenario",
          key: "scenario",
          route: "/scenarios/:id",
          pageKey: "scenario",
          icon: "description",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Settings",
          key: "settings",
          route: "/settings",
          pageKey: "settings",
          icon: "settings",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Students",
          key: "students",
          route: "/students",
          pageKey: "students",
          icon: "group",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Student",
          key: "student",
          route: "/students/:id",
          pageKey: "student",
          icon: "person",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Submissions",
          key: "submissions",
          route: "/submissions",
          pageKey: "submissions",
          icon: "assignment",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Submission",
          key: "submission",
          route: "/submissions/:id",
          pageKey: "submission",
          icon: "assignment_turned_in",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Ledger",
          key: "ledger",
          route: "/ledger",
          pageKey: "ledger",
          icon: "receipt",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Ledger Entry",
          key: "ledgerEntry",
          route: "/ledger/:id",
          pageKey: "ledgerEntry",
          icon: "receipt",
        }
    ),

    // Admin-only Job Monitoring Routes (visible only to org:admin in classroom teacher mode)
    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Jobs",
          key: "jobs",
          route: "/jobs",
          pageKey: "jobs",
          icon: "precision_manufacturing",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
          type: "item",
          name: "Scenario Jobs",
          key: "scenarioJobs",
          route: "/scenarios/:scenarioId/jobs",
          pageKey: "scenarioJobs",
          icon: "precision_manufacturing",
        }
    ),

    classroomRequired(
      isOrgAdmin &&
        isClassroomTeacher && {
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
