import checkRole from "../middleware/auth";

const getUsersRoutes = ({ activeClassroom }) => {
  // NEED TO FIX THIS TOMORROW
  const isStudent = checkRole("org:member");
  const isTeacher = checkRole("org:admin");

  const classroomRequired = (route) => activeClassroom && route;

  return [
    // ======================================================
    // GLOBAL / NO ACTIVE CLASSROOM
    // ======================================================
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
      component: "Classrooms",
      icon: "school",
    },

    // ======================================================
    // ACTIVE CLASSROOM — STUDENT ROUTES
    // ======================================================
    classroomRequired(
      isStudent && {
        type: "item",
        name: "Dashboard",
        key: "student-dashboard",
        route: "/dashboard",
        component: "StudentDashboard",
        icon: "dashboard",
      }
    ),

    classroomRequired(
      isStudent && {
        type: "item",
        name: "Scenarios",
        key: "student-scenarios",
        route: "/scenarios",
        component: "StudentScenarios",
        icon: "timeline",
      }
    ),

    classroomRequired(
      isStudent && {
        type: "hidden",
        name: "Scenario",
        key: "student-scenario",
        route: "/scenarios/:id",
        component: "StudentScenario",
      }
    ),

    classroomRequired(
      isStudent && {
        type: "item",
        name: "Store",
        key: "student-store",
        route: "/store",
        component: "StudentStore",
        icon: "store",
      }
    ),

    classroomRequired(
      isStudent && {
        type: "item",
        name: "Preferences",
        key: "student-preferences",
        route: "/preferences",
        component: "StudentPreferences",
        icon: "tune",
      }
    ),

    classroomRequired(
      isStudent && {
        type: "item",
        name: "Profile",
        key: "student-profile",
        route: "/profile",
        component: "StudentProfile",
        icon: "person",
      }
    ),

    // ======================================================
    // ACTIVE CLASSROOM — TEACHER ROUTES
    // ======================================================
    classroomRequired(
      isTeacher && {
        type: "item",
        name: "Dashboard",
        key: "teacher-dashboard",
        route: "/dashboard",
        component: "TeacherDashboard",
        icon: "dashboard",
      }
    ),

    classroomRequired(
      isTeacher && {
        type: "item",
        name: "Scenarios",
        key: "teacher-scenarios",
        route: "/scenarios",
        component: "TeacherScenarios",
        icon: "timeline",
      }
    ),

    classroomRequired(
      isTeacher && {
        type: "hidden",
        name: "Scenario",
        key: "teacher-scenario",
        route: "/scenarios/:id",
        component: "TeacherScenario",
      }
    ),

    classroomRequired(
      isTeacher && {
        type: "item",
        name: "Students",
        key: "students",
        route: "/students",
        component: "Students",
        icon: "people",
      }
    ),

    classroomRequired(
      isTeacher && {
        type: "hidden",
        name: "Student",
        key: "student",
        route: "/students/:studentId",
        component: "Student",
      }
    ),

    classroomRequired(
      isTeacher && {
        type: "hidden",
        name: "Student Scenarios",
        key: "student-scenarios",
        route: "/students/:studentId/scenarios",
        component: "StudentScenarios",
      }
    ),

    classroomRequired(
      isTeacher && {
        type: "hidden",
        name: "Student Scenario",
        key: "student-scenario-detail",
        route: "/students/:studentId/scenarios/:scenarioId",
        component: "StudentScenario",
      }
    ),

    classroomRequired(
      isTeacher && {
        type: "hidden",
        name: "Submission",
        key: "submission",
        route:
          "/students/:studentId/scenarios/:scenarioId/submissions/:submissionId",
        component: "Submission",
      }
    ),

    // ======================================================
    // TEACHER SETTINGS
    // ======================================================
    classroomRequired(
      isTeacher && {
        type: "collapse",
        name: "Settings",
        key: "settings",
        icon: "settings",
        collapse: [
          {
            type: "item",
            name: "Details",
            key: "settings-details",
            route: "/settings/details",
            component: "ClassroomSettingsDetails",
          },
          {
            type: "item",
            name: "Profile",
            key: "settings-profile",
            route: "/settings/profile",
            component: "ClassroomSettingsProfile",
          },
          {
            type: "item",
            name: "Variable Definitions",
            key: "variable-definitions",
            route: "/settings/variable-definitions",
            component: "VariableDefinitions",
          },
          {
            type: "hidden",
            name: "Variable Definition",
            key: "variable-definition",
            route: "/settings/variable-definitions/:id",
            component: "VariableDefinition",
          },
        ],
      }
    ),
  ].filter(Boolean);
};

module.exports = { getUsersRoutes };
