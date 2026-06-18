import axios from "axios";
import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import type {
  BillingSummary,
  ClassroomLicensingSummary,
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

async function createStudentCheckout(classroomId: string): Promise<{
  checkoutUrl: string;
  sessionId: string;
  planKey: string;
}> {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/licensing/student/checkout`,
    { classroomId },
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

async function getStudentAccess(): Promise<SeatClaim[]> {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/licensing/student/access`,
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
  createStudentCheckout,
  createOrgCheckout,
  getStudentAccess,
};

export default licensingService;
