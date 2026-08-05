import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import type { SetScenarioOutcomeRequest } from "../types/requests";

async function setOutcome(challengeId: string, data: SetScenarioOutcomeRequest) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/outcomes/${challengeId}/outcome`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function saveOutcomeDraft(
  challengeId: string,
  data: SetScenarioOutcomeRequest
) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/outcomes/${challengeId}/outcome/draft`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getOutcome(challengeId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/outcomes/${challengeId}/outcome`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getOutcomeForStudent(challengeId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/student/outcomes/${challengeId}/outcome`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function approveOutcome(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/outcomes/${challengeId}/outcome/approve`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function removeOutcome(challengeId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/admin/outcomes/${challengeId}/outcome`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function updateVariables(
  challengeId: string,
  variables: Record<string, unknown>
) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/admin/outcomes/${challengeId}/outcome/variables`,
    { variables },
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const outcomeService = {
  setOutcome,
  saveOutcomeDraft,
  getOutcome,
  getOutcomeForStudent,
  approveOutcome,
  removeOutcome,
  updateVariables,
};

export default outcomeService;
