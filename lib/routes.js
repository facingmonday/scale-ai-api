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
    // Show student dashboard when user is a student in the active classroom
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

    // ================= CLASSROOM TEACHER =================
    // Show teacher dashboard when user is a teacher/admin in the active classroom
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
  ].filter(Boolean);
};

module.exports = { getUsersRoutes };
