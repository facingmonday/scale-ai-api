import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import { authenticatedRequest } from "./authenticatedRequest";

async function getMe() {
  const response = await authenticatedRequest((headers) =>
    axios.get(`${API_HOST}/${API_VERSION}/auth/me`, { headers })
  );
  return response.data;
}

async function setActiveClassroom(classroomId: string | null) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/auth/active-classroom`,
    { classroomId },
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const authService = {
  getMe,
  setActiveClassroom,
};

export default authService;
