import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function joinClass(classroomId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/enrollment/class/${classroomId}/join`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}
async function getRoster(
  classroomId: string,
  page?: number,
  pageSize?: number,
  search?: string,
  sortBy?: string,
  sortOrder?: "asc" | "desc"
) {
  const params: Record<string, number | string> = {};
  if (page !== undefined) {
    params.page = page;
  }
  if (pageSize !== undefined) {
    params.pageSize = pageSize;
  }
  if (search !== undefined && search.trim() !== "") {
    params.search = search.trim();
  }
  if (sortBy !== undefined) {
    params.sortBy = sortBy;
  }
  if (sortOrder !== undefined) {
    params.sortOrder = sortOrder;
  }

  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/enrollment/admin/class/${classroomId}/roster`,
    {
      headers: await TokenHandler.getHeaders(),
      params,
    }
  );
  return response.data;
}
/**
 * Remove a student from a classroom
 * @param classroomId The ID of the classroom to remove the student from
 * @param userId The ID of the user to remove from the classroom
 * @returns The response from the API
 */
async function removeStudent(classroomId: string, userId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/enrollment/admin/class/${classroomId}/student/${userId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function transferStudent(data: {
  userId: string;
  fromClassroomId: string;
  toClassroomId: string;
}) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/enrollment/admin/transfer`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getMyClasses() {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/enrollment/my-classes`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function exportRoster(classroomId: string, filters: Record<string, any>) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/enrollment/admin/class/${classroomId}/roster/export`,
    filters,
    {
      headers: await TokenHandler.getHeaders(),
      responseType: "blob", // ✅ important
    }
  );

  // Try to read filename from Content-Disposition
  const disposition = response.headers?.["content-disposition"] as
    | string
    | undefined;

  let fileName = `class_${classroomId}_roster_export.csv`;
  if (disposition) {
    // supports: attachment; filename="abc.csv"
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^;"\n]+)/i);
    if (match?.[1]) {
      fileName = decodeURIComponent(match[1].replace(/"/g, "").trim());
    }
  }

  return {
    blob: response.data as Blob,
    fileName,
  };
}

const enrollmentService = {
  joinClass,
  getRoster,
  removeStudent,
  transferStudent,
  getMyClasses,
  exportRoster,
};

export default enrollmentService;
