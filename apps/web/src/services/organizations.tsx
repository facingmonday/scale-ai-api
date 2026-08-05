import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function create(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/organizations`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getAll() {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/organizations`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function join(organizationId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/organizations/${organizationId}/join`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const organizationsService = {
  create,
  getAll,
  join,
};

export default organizationsService;
