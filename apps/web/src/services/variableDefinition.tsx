import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import type { VariableDefinition } from "../types/variableDefinition";

type VariableDefinitionRequest = {
  challengeId?: string | null;
  label: string;
  description?: string;
  appliesTo: VariableDefinition["appliesTo"];
  dataType: VariableDefinition["dataType"];
  inputType?: VariableDefinition["inputType"];
  options?: unknown[];
  defaultValue?: unknown;
  min?: number;
  max?: number;
  required?: boolean;
  isActive?: boolean;
};

async function create(data: VariableDefinitionRequest & {
  classroomId: string;
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
  data: Partial<VariableDefinitionRequest>,
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/variables/${key}`);
  url.searchParams.append("classroomId", classroomId);
  if (data.challengeId) {
    url.searchParams.append("challengeId", data.challengeId);
  }
  const response = await axios.put(url.toString(), data, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getAll(classroomId: string, appliesTo?: string, challengeId?: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/variables`);
  url.searchParams.append("classroomId", classroomId);
  if (appliesTo) {
    url.searchParams.append("appliesTo", appliesTo);
  }
  if (challengeId) {
    url.searchParams.append("challengeId", challengeId);
  }
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function remove(
  key: string,
  classroomId: string,
  challengeId?: string,
) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/variables/${key}`);
  url.searchParams.append("classroomId", classroomId);
  if (challengeId) {
    url.searchParams.append("challengeId", challengeId);
  }
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
