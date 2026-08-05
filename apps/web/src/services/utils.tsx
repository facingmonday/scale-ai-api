import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function transcribeVideo(queryParams?: Record<string, any>) {
  const url = new URL(`${API_HOST}/${API_VERSION}/utils/transcribe-video`);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function createEventObjectsFromJson(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/utils/event-objects-from-json`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function createEventObjectsFromText(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/utils/event-objects-from-text`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function createEventObjectsFromImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/utils/event-objects-from-image`,
    formData,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const utilsService = {
  transcribeVideo,
  createEventObjectsFromJson,
  createEventObjectsFromText,
  createEventObjectsFromImage,
};

export default utilsService;
