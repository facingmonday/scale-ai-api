const PLAN_KEYS = {
  STUDENT_CLASS_PASS: "student_class_pass",
  TEACHER_SEAT_PACK_30: "teacher_seat_pack_30",
  TEACHER_SEAT_PACK_100: "teacher_seat_pack_100",
  INSTITUTION_ENTERPRISE: "institution_enterprise",
};

const PLAN_CATALOG = {
  [PLAN_KEYS.STUDENT_CLASS_PASS]: {
    key: PLAN_KEYS.STUDENT_CLASS_PASS,
    label: "Student Class Pass",
    purchaserScope: "user",
    seatPoolScope: "user",
    seatCount: 1,
    classroomLimit: 1,
    features: {
      studentPaysAllowed: true,
      classroomScoped: true,
    },
  },
  [PLAN_KEYS.TEACHER_SEAT_PACK_30]: {
    key: PLAN_KEYS.TEACHER_SEAT_PACK_30,
    label: "Teacher Seat Pack - 30",
    purchaserScope: "organization",
    seatPoolScope: "organization",
    seatCount: 30,
    classroomLimit: 3,
    features: {
      teacherPaidSeats: true,
      rosterReservations: true,
    },
  },
  [PLAN_KEYS.TEACHER_SEAT_PACK_100]: {
    key: PLAN_KEYS.TEACHER_SEAT_PACK_100,
    label: "Teacher Seat Pack - 100",
    purchaserScope: "organization",
    seatPoolScope: "organization",
    seatCount: 100,
    classroomLimit: 10,
    features: {
      teacherPaidSeats: true,
      rosterReservations: true,
    },
  },
  [PLAN_KEYS.INSTITUTION_ENTERPRISE]: {
    key: PLAN_KEYS.INSTITUTION_ENTERPRISE,
    label: "Institution Enterprise",
    purchaserScope: "organization",
    seatPoolScope: "organization",
    seatCount: null,
    classroomLimit: null,
    features: {
      teacherPaidSeats: true,
      rosterReservations: true,
      domainRestrictions: true,
      managedBilling: true,
    },
  },
};

function getPlan(planKey) {
  return PLAN_CATALOG[planKey] || null;
}

function getDefaultFreeTeacherLimits() {
  return {
    planKey: "free_teacher_workspace",
    classroomLimit: Number(process.env.FREE_TEACHER_CLASSROOM_LIMIT || 3),
    studentPaysAllowed: true,
  };
}

module.exports = {
  PLAN_KEYS,
  PLAN_CATALOG,
  getPlan,
  getDefaultFreeTeacherLimits,
};
