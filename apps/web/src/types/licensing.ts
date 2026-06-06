export type BillingMode =
  | "student_paid"
  | "teacher_paid_open"
  | "teacher_paid_roster"
  | "hybrid"
  | "roster_only"
  | "open_free";

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

export interface ClassroomSeatAllocation {
  _id: string;
  classroomId: string;
  seatPoolId: string | SeatPool;
  seatsAllocated: number;
  seatsClaimed: number;
  remainingSeats?: number;
  mode: "open" | "roster_reserved" | "invite_only";
  status: "active" | "paused" | "expired" | "revoked";
}

export interface SeatClaim {
  _id: string;
  classroomId:
    | string
    | {
        _id: string;
        name: string;
        description?: string;
        billingMode?: BillingMode;
      };
  source:
    | "student_purchase"
    | "teacher_assigned"
    | "teacher_open"
    | "enterprise"
    | "manual_comp"
    | "roster_reserved"
    | "free_teacher_workspace";
  status: "active" | "revoked" | "expired";
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

export interface BillingSubscription {
  _id: string;
  planKey: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "expired" | "manual";
  purchaserScope: "user" | "organization";
  purchaserUserId?: string;
  purchaserOrganizationId?: string;
}

export interface BillingSummary {
  plans: BillingSubscription[];
  seatPools: SeatPool[];
  classroomUsage: Array<{
    classroomId: string;
    name: string;
    billingMode?: BillingMode;
    joinPolicy?: JoinPolicy;
    claimedSeats: number;
  }>;
  userClaims: SeatClaim[];
  freeTeacherLimits: {
    planKey: string;
    classroomLimit: number;
    studentPaysAllowed: boolean;
  };
}

export interface ClassroomLicensingSummary {
  classroom: {
    _id: string;
    name: string;
    billingMode: BillingMode;
    joinPolicy: JoinPolicy;
    studentPaysAllowed: boolean;
    allowedDomains: string[];
    allowAnonymousJoin?: boolean;
  };
  allocations: ClassroomSeatAllocation[];
  claimedSeats: number;
  roster: {
    total: number;
    reserved: number;
    claimed: number;
    revoked: number;
    invalid: number;
  };
}
