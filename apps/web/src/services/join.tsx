import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function join(orgId: string, classroomId: string, studentId?: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/join`,
    { orgId, classroomId, studentId },
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const joinService = {
  join,
};

export default joinService;


