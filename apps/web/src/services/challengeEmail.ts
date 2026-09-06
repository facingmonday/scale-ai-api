import axios from "axios";
import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import type {
  ChallengeEmailAudience,
  ChallengeEmailHistory,
  ChallengeEmailPreview,
} from "../types/challengeEmail";

async function request<T>(
  id: string,
  method: "get" | "post" | "put" | "delete",
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await axios({
    method,
    url: `${API_HOST}/${API_VERSION}/admin/challenges/${id}/${path}`,
    data,
    headers: await TokenHandler.getHeaders(),
  });
  return response.data.data as T;
}
export default {
  list: (id: string) => request<ChallengeEmailHistory>(id, "get", "emails"),
  preview: (id: string, audience: ChallengeEmailAudience) =>
    request<ChallengeEmailPreview>(id, "post", "emails/preview", { audience }),
  send: (id: string, audience: ChallengeEmailAudience, requestKey: string) =>
    request<{ runId: string }>(id, "post", "emails", { audience, requestKey }),
  schedule: (
    id: string,
    localTime: string,
    requestKey: string,
    reminderId?: string,
  ) =>
    request(
      id,
      reminderId ? "put" : "post",
      reminderId ? `reminders/${reminderId}` : "reminders",
      { localTime, requestKey },
    ),
  cancel: (id: string, reminderId: string) =>
    request(id, "delete", `reminders/${reminderId}`),
};
