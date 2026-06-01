import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import type {
  AdminDashboardResponse,
  StudentDashboardResponse,
} from "../types/dashboard";
import type { BillingMode, JoinPolicy } from "../types/licensing";
import type { ClassroomAutomationSettings } from "../types/classroom";

async function create(data: {
  name: string;
  description?: string;
  imageUrl?: string;
  templateId?: string;
  billingMode?: BillingMode;
  joinPolicy?: JoinPolicy;
  studentPaysAllowed?: boolean;
  allowedDomains?: string[];
  accessCode?: string;
  allowAnonymousJoin?: boolean;
}) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/class`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getAdminDashboard(
  classroomId: string
): Promise<AdminDashboardResponse> {
  const response = await axios.get<AdminDashboardResponse>(
    `${API_HOST}/${API_VERSION}/admin/class/${classroomId}/dashboard`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getStudentDashboard(
  classroomId: string
): Promise<StudentDashboardResponse> {
  const response = await axios.get<StudentDashboardResponse>(
    `${API_HOST}/${API_VERSION}/student/class/${classroomId}/dashboard`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function inviteStudent(classroomId: string, email: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/class/${classroomId}/invite`,
    { email },
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getAll() {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/admin/class`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function update(
  classroomId: string,
  data: Partial<{
    name: string;
    description: string;
    imageUrl: string;
    prompts: Array<{
      role: "system" | "user" | "assistant" | "developer";
      content: string;
    }>;
    billingMode: BillingMode;
    joinPolicy: JoinPolicy;
    studentPaysAllowed: boolean;
    allowedDomains: string[];
    accessCode: string;
    allowAnonymousJoin: boolean;
    automationSettings: ClassroomAutomationSettings;
  }>
) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/admin/class/${classroomId}`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function remove(classroomId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/admin/class/${classroomId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function removeAllVariables(classroomId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/admin/class/${classroomId}/variables`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function restoreTemplate(
  classroomId: string,
  body?: { templateId?: string; templateKey?: string }
) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/class/${classroomId}/restore-template`,
    body ?? {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const classroomService = {
  create,
  getAdminDashboard,
  getStudentDashboard,
  inviteStudent,
  getAll,
  update,
  remove,
  removeAllVariables,
  restoreTemplate,
};

export default classroomService;
