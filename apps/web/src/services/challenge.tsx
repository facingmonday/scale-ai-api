import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import type {
  CreateScenarioRequest,
  CreateScenarioWithAIRequest,
} from "../types/requests";
import type {
  ChallengePreviewResponse,
  ChallengePreviewTarget,
} from "../types/challenge";

type UpdateScenarioRequest = Partial<CreateScenarioRequest> & {
  isClosed?: boolean;
  reason?: string;
};

async function create(data: CreateScenarioRequest) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function createWithAI(data: CreateScenarioWithAIRequest) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/ai`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

async function update(challengeId: string, data: UpdateScenarioRequest) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function publish(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/publish`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function unpublish(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/unpublish`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function preview(
  challengeId: string,
  targets?: ChallengePreviewTarget[],
): Promise<ChallengePreviewResponse> {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/preview`,
    targets ? { targets } : {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return (response.data?.data ?? response.data) as ChallengePreviewResponse;
}

async function approve(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/approve`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function rerun(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/rerun`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function cancelBatchAndRerun(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/cancel-batch-and-rerun`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function stopCalculationAndReopen(
  challengeId: string,
  schedule: { closeSubmissionsAt: string; processAt: string },
) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/stop-calculation-and-reopen`,
    schedule,
    { headers: await TokenHandler.getHeaders() },
  );
  return response.data;
}

async function generateDebrief(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/debrief`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    },
  );
  return response.data;
}

async function getCurrent(classroomId: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/student/challenges/current`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getCurrentAdmin(classroomId: string) {
  const url = new URL(`${API_HOST}/${API_VERSION}/admin/challenges/current`);
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getAll(classroomId: string, role: "student" | "admin") {
  const url = new URL(
    `${API_HOST}/${API_VERSION}/${role ?? "admin"}/challenges`
  );
  url.searchParams.append("classroomId", classroomId);
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getById(challengeId: string, role: "student" | "admin") {
  const url = new URL(
    `${API_HOST}/${API_VERSION}/${role ?? "admin"}/challenges/${challengeId}`
  );
  // Request decision variables to be populated
  url.searchParams.append("populate", "decision.variables");
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function remove(challengeId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function deleteScenarioSubmissions(challengeId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/decisions`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function exportSubmissions(
  challengeId: string,
  filters: Record<string, unknown>
) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/export`,
    filters,
    {
      headers: await TokenHandler.getHeaders(),
      responseType: "blob", // ✅ important
    }
  );

  // Try to read filename from Content-Disposition
  const disposition =
    (response.headers?.["content-disposition"] as string | undefined) ??
    (response.headers?.["Content-Disposition"] as string | undefined) ??
    (response.request?.getResponseHeader?.(
      "content-disposition"
    ) as string | undefined);

  let fileName = `scenario_${challengeId}_export.csv`;
  if (disposition) {
    // supports: attachment; filename="abc.csv"
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^;"\n]+)/i);
    if (match?.[1]) {
      fileName = decodeURIComponent(match[1].replace(/"/g, "").trim());
    }
  }

  return {
    blob: response.data as Blob,
    fileName,
  };
}

async function releaseFeedback(challengeId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/admin/challenges/${challengeId}/release-feedback`,
    {},
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const challengeService = {
  create,
  createWithAI,
  update,
  publish,
  unpublish,
  preview,
  approve,
  rerun,
  cancelBatchAndRerun,
  stopCalculationAndReopen,
  generateDebrief,
  releaseFeedback,
  getCurrent,
  getCurrentAdmin,
  getAll,
  getById,
  remove,
  deleteScenarioSubmissions,
  exportSubmissions,
};

export default challengeService;
