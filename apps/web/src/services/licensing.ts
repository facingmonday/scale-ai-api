import axios from "axios";
import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import type {
  BillingSummary,
  ClassroomLicensingSummary,
  OrgSeatReservation,
  RosterSeat,
  SeatClaim,
  SeatPool,
} from "../types/licensing";

async function getSummary(): Promise<BillingSummary> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/summary`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function getSeatPools(): Promise<SeatPool[]> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/seat-pools`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function getClassroomSummary(
  classroomId: string,
): Promise<ClassroomLicensingSummary> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/classrooms/${classroomId}/summary`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function importRoster(
  classroomId: string,
  data: {
    csv?: string;
    rows?: Array<Record<string, string>>;
  },
) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/licensing/classrooms/${classroomId}/roster-import`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function getRosterSeats(classroomId: string): Promise<RosterSeat[]> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/classrooms/${classroomId}/roster-seats`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function clearRoster(
  classroomId: string,
): Promise<{ deleted: number; detachedClaims: number }> {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/licensing/classrooms/${classroomId}/roster-seats`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function createStudentCheckout(
  classroomId: string,
  orgId?: string,
): Promise<{
  checkoutUrl: string;
  sessionId: string;
  planKey: string;
}> {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/licensing/student/checkout`,
    { classroomId, orgId },
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function createOrgCheckout(quantity: number): Promise<{
  checkoutUrl: string;
  sessionId: string;
  planKey: string;
  quantity: number;
}> {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/licensing/org/checkout`,
    { quantity },
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function getStudentCheckoutStatus(sessionId: string): Promise<{
  status: "pending" | "completed";
  paymentStatus: string;
  processedAt?: string | null;
}> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/student/checkout-status`,
    {
      params: { sessionId },
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function getStudentAccess(): Promise<SeatClaim[]> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/student/access`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function getSeatReservations(): Promise<OrgSeatReservation[]> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/seat-reservations`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function createSeatReservation(email: string): Promise<OrgSeatReservation> {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/licensing/seat-reservations`,
    { email },
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function revokeSeatReservation(id: string): Promise<OrgSeatReservation> {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/licensing/seat-reservations/${id}`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

async function grantSeat(data: {
  userId: string;
  classroomId: string;
  source?: "manual_comp" | "teacher_assigned";
  reason?: string;
}) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/licensing/admin/grant-seat`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data.data;
}

const licensingService = {
  getSummary,
  getSeatPools,
  getClassroomSummary,
  importRoster,
  getRosterSeats,
  clearRoster,
  createStudentCheckout,
  createOrgCheckout,
  getStudentCheckoutStatus,
  getStudentAccess,
  getSeatReservations,
  createSeatReservation,
  revokeSeatReservation,
  grantSeat,
};

export default licensingService;
