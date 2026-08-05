import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function getJobsForScenario(challengeId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/job/challenge/${challengeId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getById(jobId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function retry(jobId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}/retry`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function processPending(limit: number = 10) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/process-pending`,
    { limit },
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function cancel(jobId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}/cancel`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function deleteJob(jobId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/admin/job/${jobId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const jobService = {
  getJobsForScenario,
  getById,
  retry,
  processPending,
  cancel,
  deleteJob,
};

export default jobService;
