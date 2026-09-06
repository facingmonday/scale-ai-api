import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function getJobsForScenario(challengeId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/job/challenge/${challengeId}`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

async function getById(jobId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

async function retry(jobId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}/retry`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

async function processPending(limit: number = 10, challengeId?: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/process-pending`,
    { limit, challengeId },
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

async function rerunStudent(challengeId: string, decisionId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/challenge/${challengeId}/decision/${decisionId}/rerun`,
    {},
    { headers: await TokenHandler.getHeaders() },
  );
  return response.data;
}

async function publishReplacement(replacementId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/replacement/${replacementId}/publish`,
    {},
    { headers: await TokenHandler.getHeaders() },
  );
  return response.data;
}

async function discardReplacement(replacementId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/replacement/${replacementId}/discard`,
    {},
    { headers: await TokenHandler.getHeaders() },
  );
  return response.data;
}

async function notifyReplacement(replacementId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/replacement/${replacementId}/notify`,
    {},
    { headers: await TokenHandler.getHeaders() },
  );
  return response.data;
}

async function cancel(jobId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}/cancel`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

async function deleteJob(jobId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}`,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

const jobService = {
  getJobsForScenario,
  getById,
  retry,
  processPending,
  rerunStudent,
  publishReplacement,
  discardReplacement,
  notifyReplacement,
  cancel,
  deleteJob,
};

export default jobService;
