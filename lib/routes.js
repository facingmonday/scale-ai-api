const getUsersRoutes = ({ activeClassroom, role = "org:member" }) => {
  const isStudent = role === "org:member";
  const isTeacher = role === "org:admin";

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

    // ================= STUDENT =================
    classroomRequired(
      isStudent && {
        type: "item",
        name: "Dashboard",
        key: "dashboard",
        route: "/dashboard",
        pageKey: "dashboard",
        icon: "dashboard",
      }
    ),

    // ================= TEACHER =================
    classroomRequired(
      isTeacher && {
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
