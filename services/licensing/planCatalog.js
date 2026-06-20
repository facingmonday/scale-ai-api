const PLAN_KEYS = {
  ORG_SEATS: "org_seats",
  STUDENT_CLASS_PASS: "student_class_pass",
};

const PLAN_CATALOG = {
  [PLAN_KEYS.ORG_SEATS]: {
    key: PLAN_KEYS.ORG_SEATS,
    label: "Organization Seats",
    purchaserScope: "organization",
    seatPoolScope: "organization",
    seatCount: null,
    features: {
      stripeCheckout: true,
    },
  },
  [PLAN_KEYS.STUDENT_CLASS_PASS]: {
    key: PLAN_KEYS.STUDENT_CLASS_PASS,
    label: "Student Seat",
    purchaserScope: "user",
    seatPoolScope: "user",
    seatCount: 1,
    features: {
      stripeCheckout: true,
      perEnrollment: true,
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
  };
}

module.exports = {
  PLAN_KEYS,
  PLAN_CATALOG,
  getPlan,
  getDefaultFreeTeacherLimits,
};
