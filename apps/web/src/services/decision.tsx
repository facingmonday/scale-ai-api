import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import type { StudentResultRecalculationResponse } from "../types/decision";

async function submit(data: {
  challengeId: string;
  variables: Record<string, unknown>;
  challengeVariableAnswers: Record<string, unknown>;
}) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/student/decision`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function update(
  decisionId: string,
  data: {
    challengeId: string;
    variables: Record<string, unknown>;
    challengeVariableAnswers: Record<string, unknown>;
  }
) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/student/decision/${decisionId}`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getStatus(challengeId: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/student/decision/status`);
  url.searchParams.append("challengeId", challengeId);
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getMissingSubmissionsForScenario(
  challengeId: string,
) {
  const url = new URL(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/missing-decisions`
  );

  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });

  return response.data;
}


async function getAll(classroomId: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/decisions`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getById(decisionId: string, role: "student" | "admin") {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/${role ?? "admin"}/decisions/${decisionId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function recalculateStudentResult(
  decisionId: string
): Promise<StudentResultRecalculationResponse> {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/decisions/${decisionId}/recalculate`,
    {},
    { headers: await TokenHandler.getHeaders() }
  );
  return response.data as StudentResultRecalculationResponse;
}

async function getStudentSubmissions(params?: {
  classroomId?: string;
  challengeId?: string;
}) {
  const url = new URL(`${API_HOST}/${API_VERSION}/student/decisions`);

  if (params?.classroomId) {
    url.searchParams.append("classroomId", params.classroomId);
  }

  if (params?.challengeId) {
    url.searchParams.append("challengeId", params.challengeId);
  }

  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function deleteStudentSubmissions(
  studentId: string,
  classroomId?: string
) {
  const url = new URL(
    `${API_HOST}/${API_VERSION}/admin/decisions/student/${studentId}`
  );

  if (classroomId) {
    url.searchParams.append("classroomId", classroomId);
  }

  const response = await axios.delete(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getAllPerStudent(studentId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/decisions/student/${studentId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function search(params: {
  classroomId: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  filters?: Array<{ field: string; operator: string; value: unknown }>;
  includeJobs?: boolean;
}) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/decisions`,
    params,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const decisionService = {
  submit,
  update,
  getStatus,
  getMissingSubmissionsForScenario,
  getAll,
  getById,
  recalculateStudentResult,
  getStudentSubmissions,
  deleteStudentSubmissions,
  getAllPerStudent,
  search,
};

export default decisionService;
