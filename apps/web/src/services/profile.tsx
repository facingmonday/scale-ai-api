import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function create(data: {
  classroomId: string;
  studentId: string;
  shopName: string;
  profileType: string;
  storeDescription?: string;
  storeLocation?: string;
  imageUrl?: string;
  variables?: Record<string, unknown>;
}) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/student/profile`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getStudentStore(classroomId: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/student/profile`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getStudentStoreAdmin(classroomId: string, userId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/class/${classroomId}/profile/${userId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function update(
  classroomId: string,
  data: {
    studentId?: string;
    shopName?: string;
    profileType?: string;
    storeDescription?: string;
    storeLocation?: string;
    imageUrl?: string;
    variables?: Record<string, unknown>;
  }
) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/student/profile`,
    { ...data, classroomId },
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const profileService = {
  create,
  getStudentStore,
  getStudentStoreAdmin,
  update,
};

export default profileService;
