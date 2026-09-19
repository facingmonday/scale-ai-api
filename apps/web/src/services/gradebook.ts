import axios from "axios";
import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import type {
  Gradebook,
  GradeFilters,
  GradeHistory,
  GradeMode,
} from "../types/gradebook";

const base = (classroomId: string) =>
  `${API_HOST}/${API_VERSION}/admin/class/${encodeURIComponent(classroomId)}/gradebook`;
const target = (classroomId: string, challengeId: string, studentId?: string) =>
  `${base(classroomId)}/challenges/${encodeURIComponent(challengeId)}${studentId ? `/students/${encodeURIComponent(studentId)}` : ""}`;

export default {
  async get(
    classroomId: string,
    filters: GradeFilters,
    signal?: AbortSignal,
  ): Promise<Gradebook> {
    const res = await axios.get(base(classroomId), {
      headers: await TokenHandler.getHeaders(),
      signal,
      params: { ...filters, challengeIds: filters.challengeIds.join(",") },
    });
    return res.data.data;
  },
  async settings(
    classroomId: string,
    signal?: AbortSignal,
  ): Promise<{ defaultChallengePoints: number }> {
    const res = await axios.get(`${base(classroomId)}/settings`, {
      headers: await TokenHandler.getHeaders(),
      signal,
    });
    return res.data.data;
  },
  async updateSettings(
    classroomId: string,
    defaultChallengePoints: number,
  ): Promise<void> {
    await axios.put(
      `${base(classroomId)}/settings`,
      { defaultChallengePoints },
      { headers: await TokenHandler.getHeaders() },
    );
  },
  async adjust(
    classroomId: string,
    challengeId: string,
    studentId: string,
    data: {
      mode: GradeMode;
      points?: number;
      reason: string;
      expectedRevision: number;
    },
  ): Promise<void> {
    await axios.put(
      `${target(classroomId, challengeId, studentId)}/adjustment`,
      data,
      { headers: await TokenHandler.getHeaders() },
    );
  },
  async exclude(
    classroomId: string,
    challengeId: string,
    data: { excluded: boolean; reason: string; expectedRevision: number },
  ): Promise<void> {
    await axios.put(`${target(classroomId, challengeId)}/exclusion`, data, {
      headers: await TokenHandler.getHeaders(),
    });
  },
  async history(
    classroomId: string,
    challengeId: string,
    studentId?: string,
    before?: number,
    signal?: AbortSignal,
  ): Promise<GradeHistory> {
    const res = await axios.get(
      `${target(classroomId, challengeId, studentId)}/history`,
      { headers: await TokenHandler.getHeaders(), params: { before }, signal },
    );
    return res.data.data;
  },
  async export(
    classroomId: string,
    filters: GradeFilters,
    layout: "gradebook" | "detailed",
    signal?: AbortSignal,
  ): Promise<Blob> {
    try {
      const res = await axios.post(
        `${base(classroomId)}/export`,
        { ...filters, layout },
        {
          headers: await TokenHandler.getHeaders(),
          responseType: "blob",
          signal,
        },
      );
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        const data = JSON.parse(await error.response.data.text());
        throw new Error(data.error || "Unable to export grades.");
      }
      throw error;
    }
  },
};
