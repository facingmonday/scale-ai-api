import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function getAll(
  role: "admin" | "student" = "admin",
  params?: { classroomId?: string }
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/${role}/profile-types`);

  const classroomId = params?.classroomId;
  if (classroomId) {
    url.searchParams.append("classroomId", classroomId);
  }

  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getByKey(key: string, params?: { classroomId?: string }) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/profile-types/${key}`);
  const classroomId = params?.classroomId;
  if (classroomId) {
    url.searchParams.append("classroomId", classroomId);
  }

  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function create(
  data: {
    key: string;
    label: string;
    description?: string;
    isActive?: boolean;
    startingBalance?: number;
    initialStartupCost?: number;
    variables?: Record<string, unknown>;
  },
  params?: { classroomId?: string }
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/profile-types`);
  const classroomId = params?.classroomId;
  if (classroomId) {
    url.searchParams.append("classroomId", classroomId);
  }

  const response = await axios.post(url.toString(), data, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function update(
  id: string,
  data: Partial<{
    label: string;
    description: string;
    isActive: boolean;
    startingBalance: number;
    initialStartupCost: number;
    variables: Record<string, unknown>;
  }>,
  params?: { classroomId?: string }
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/profile-types/${id}`);
  const classroomId = params?.classroomId;
  if (classroomId) {
    url.searchParams.append("classroomId", classroomId);
  }

  const response = await axios.put(url.toString(), data, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function remove(id: string, params?: { classroomId?: string }) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/profile-types/${id}`);
  const classroomId = params?.classroomId;
  if (classroomId) {
    url.searchParams.append("classroomId", classroomId);
  }

  const response = await axios.delete(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

const profileTypeService = {
  getAll,
  getByKey,
  create,
  update,
  remove,
};

export default profileTypeService;
