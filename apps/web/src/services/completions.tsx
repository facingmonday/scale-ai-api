import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";

import axios from "axios";

export async function fetchCompletion(prompt: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/openai/completion`,
    { prompt },
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  // The body should be text, get that out of the response
  const { text } = response.data;
  return text;
}
