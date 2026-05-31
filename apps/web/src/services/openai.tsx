import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function getCompletion(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/openai/completion`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function generateImage(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/openai/generate`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function analyzeImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/openai/analyze-image`,
    formData,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function transcribeAudio(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/openai/transcribe-audio`,
    formData,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const openaiService = {
  getCompletion,
  generateImage,
  analyzeImage,
  transcribeAudio,
};

export default openaiService;
