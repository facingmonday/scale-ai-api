export type JoinPolicy = "invite_link" | "open" | "roster_only" | "closed";

export interface SeatPool {
  _id: string;
  planKey: string;
  scope: "user" | "teacher" | "organization";
  totalSeats: number | null;
  usedSeats: number;
  remainingSeats?: number | null;
  status: "active" | "past_due" | "canceled" | "expired" | "manual";
}

export interface SeatClaim {
  _id: string;
  classroomId:
    | string
    | {
        _id: string;
        name: string;
        description?: string;
      };
  source:
    | "org_prepaid"
    | "org_reserved"
    | "stripe_student"
    | "student_purchase"
    | "teacher_assigned"
    | "teacher_open"
    | "enterprise"
    | "manual_comp"
    | "roster_reserved"
    | "free_teacher_workspace";
  status: "active" | "held" | "revoked" | "expired";
  claimedAt: string;
  seatPoolId?: string | SeatPool;
}

export interface RosterSeat {
  _id: string;
  classroomId: string;
  email: string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  section?: string;
  status: "reserved" | "claimed" | "revoked" | "invalid";
}

export interface OrgSeatReservation {
  _id: string;
  email: string;
  status: "reserved" | "claimed" | "revoked";
  claimedAt?: string;
  claimedClassroomId?: string;
}

export interface BillingSummary {
  seatPools: SeatPool[];
  classroomUsage: Array<{
    classroomId: string;
    name: string;
    joinPolicy?: JoinPolicy;
    claimedSeats: number;
  }>;
  userClaims: SeatClaim[];
  orgSeatSummary?: {
    totalSeats: number;
    usedSeats: number;
    reservedUnclaimed?: number;
    floatingAvailable?: number;
    remainingSeats: number;
    poolId?: string;
  };
  stripePaidSeats?: number;
  freeTeacherLimits: {
    planKey: string;
    classroomLimit: number;
  };
}

export interface ClassroomLicensingSummary {
  classroom: {
    _id: string;
    name: string;
    joinPolicy: JoinPolicy;
    allowedDomains: string[];
    allowAnonymousJoin?: boolean;
  };
  claimedSeats: number;
  roster: {
    total: number;
    reserved: number;
    claimed: number;
    revoked: number;
    invalid: number;
  };
}
