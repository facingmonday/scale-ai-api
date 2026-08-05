import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function getHistoryForUser(classroomId: string, userId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/ledger/${classroomId}/user/${userId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getEntriesForScenario(challengeId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/ledger/challenges/${challengeId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getEntryForScenarioAndUser(challengeId: string, userId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/admin/ledger/challenge/${challengeId}/user/${userId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function overrideEntry(ledgerId: string, data: any) {
  const response = await axios.patch(
    `${API_HOST}/${API_VERSION}/admin/ledger/${ledgerId}/override`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getCalculationDetails(
  ledgerId: string,
  isAdmin: boolean = false
) {
  const endpoint = isAdmin
    ? `${API_HOST}/${API_VERSION}/admin/ledger/${ledgerId}/calculation-details`
    : `${API_HOST}/${API_VERSION}/student/ledger/${ledgerId}/calculation-details`;

  const response = await axios.get(endpoint, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

const ledgerService = {
  getHistoryForUser,
  getEntriesForScenario,
  getEntryForScenarioAndUser,
  overrideEntry,
  getCalculationDetails,
};

export default ledgerService;
