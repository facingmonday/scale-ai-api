import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import type {
  CreateMetricDefinitionRequest,
  UpdateMetricDefinitionRequest,
} from "../types/metric";

async function create(
  classroomId: string,
  data: CreateMetricDefinitionRequest
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/metrics`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.post(url.toString(), data, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function update(
  key: string,
  classroomId: string,
  data: UpdateMetricDefinitionRequest
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/metrics/${key}`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.put(url.toString(), data, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getAll(classroomId: string, includeInactive?: boolean) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/metrics`);
  url.searchParams.append("classroomId", classroomId);
  if (includeInactive) {
    url.searchParams.append("includeInactive", "true");
  }
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function remove(key: string, classroomId: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/metrics/${key}`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.delete(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

const metricDefinitionsService = {
  create,
  update,
  getAll,
  remove,
};

export default metricDefinitionsService;
