import axios from "axios";
import TokenHandler from "./base";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "AuthenticationRequiredError";
  }
}

// Retry only an explicit authentication rejection, never an ambiguous network
// failure: the server may already have saved a submission in the latter case.
export async function authenticatedRequest<T>(
  request: (headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = await TokenHandler.getHeaders({ skipCache: attempt === 1 });
    if (!headers.Authorization) throw new AuthenticationRequiredError();
    try {
      return await request(headers);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
      if (attempt === 1) throw new AuthenticationRequiredError();
    }
  }
  throw new AuthenticationRequiredError();
}
