import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import type { ClassroomTemplate } from "../types/classroomTemplate";

type ClassroomTemplatesResponse =
  | {
      success: boolean;
      data: ClassroomTemplate[];
    }
  | ClassroomTemplate[];

type ClassroomTemplateResponse =
  | {
      success: boolean;
      data: ClassroomTemplate;
    }
  | ClassroomTemplate;

function unwrapTemplate(payload: unknown): ClassroomTemplate {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: unknown }).data
  ) {
    return (payload as { data: ClassroomTemplate }).data;
  }
  return payload as ClassroomTemplate;
}

async function getAll(): Promise<ClassroomTemplate[]> {
  const response = await axios.get<ClassroomTemplatesResponse>(
    `${API_HOST}/${API_VERSION}/admin/classroom-templates`,
    { headers: await TokenHandler.getHeaders() }
  );
  const payload = response?.data as unknown;

  // Expected: { success: true, data: [...] }
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: ClassroomTemplate[] }).data;
  }

  // Back-compat: direct array response
  if (Array.isArray(payload)) return payload as ClassroomTemplate[];

  return [];
}

async function createFromClassroom(
  params: { classroomId: string; includeInactive?: boolean },
  body?: {
    key?: string;
    label?: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<ClassroomTemplate> {
  const url = new URL(
    `${API_HOST}/${API_VERSION}/admin/classroom-templates/from-classroom`
  );
  url.searchParams.append("classroomId", params.classroomId);
  if (typeof params.includeInactive === "boolean") {
    url.searchParams.append("includeInactive", String(params.includeInactive));
  }

  const response = await axios.post<ClassroomTemplateResponse>(
    url.toString(),
    body ?? {},
    { headers: await TokenHandler.getHeaders() }
  );
  return unwrapTemplate(response?.data as unknown);
}

async function overwriteFromClassroom(params: {
  classroomId: string;
  key?: string;
  includeInactive?: boolean;
}): Promise<ClassroomTemplate> {
  const url = new URL(
    `${API_HOST}/${API_VERSION}/admin/classroom-templates/from-classroom`
  );
  url.searchParams.append("classroomId", params.classroomId);
  if (params.key) {
    url.searchParams.append("key", params.key);
  }
  if (typeof params.includeInactive === "boolean") {
    url.searchParams.append("includeInactive", String(params.includeInactive));
  }

  const response = await axios.put<ClassroomTemplateResponse>(
    url.toString(),
    {},
    { headers: await TokenHandler.getHeaders() }
  );
  return unwrapTemplate(response?.data as unknown);
}

const classroomTemplatesService = {
  getAll,
  createFromClassroom,
  overwriteFromClassroom,
};

export default classroomTemplatesService;
