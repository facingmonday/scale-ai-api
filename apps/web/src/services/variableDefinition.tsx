import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function create(data: {
  classroomId: string;
  key: string;
  label: string;
  description?: string;
  appliesTo: string;
  dataType: string;
  inputType?: string;
  options?: any[];
  defaultValue?: any;
  min?: number;
  max?: number;
  required?: boolean;
  isActive?: boolean;
}) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/variables`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function update(
  key: string,
  classroomId: string,
  data: Partial<{
    label: string;
    description: string;
    appliesTo: string;
    dataType: string;
    inputType: string;
    options: any[];
    defaultValue: any;
    min: number;
    max: number;
    required: boolean;
    isActive: boolean;
  }>
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/variables/${key}`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.put(url.toString(), data, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getAll(classroomId: string, appliesTo?: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/variables`);
  url.searchParams.append("classroomId", classroomId);
  if (appliesTo) {
    url.searchParams.append("appliesTo", appliesTo);
  }
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function remove(key: string, classroomId: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/variables/${key}`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.delete(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

const variableDefinitionsService = {
  create,
  update,
  getAll,
  remove,
};

export default variableDefinitionsService;
