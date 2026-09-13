import axios from "axios";
import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";

export interface StudentActivityEvent {
  id: string;
  at: string;
  action: string;
  title: string;
  challengeId: string;
  challengeTitle: string;
  answers?: {
    variables?: Record<string, unknown>;
    challengeVariableAnswers?: Record<string, unknown>;
    labels?: Record<string, string>;
  };
}

export interface StudentActivityPage {
  data: StudentActivityEvent[];
  hasMore: boolean;
  offset: number;
  limit: number;
}

export async function getStudentActivity(
  classroomId: string,
  studentId: string | undefined,
  offset: number,
  signal: AbortSignal,
): Promise<StudentActivityPage> {
  const path = studentId
    ? `/admin/students/${encodeURIComponent(studentId)}/activity`
    : "/student/activity";
  const response = await axios.get(`${API_HOST}/${API_VERSION}${path}`, {
    headers: await TokenHandler.getHeaders(),
    params: { classroomId, offset, limit: 10 },
    timeout: 15000,
    signal,
  });
  return response.data;
}
