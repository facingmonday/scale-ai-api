import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function getChatHistory(classroomId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/ai/chat/history`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function getClassroomReports(classroomId: string, tag?: string, search?: string) {
  const params: Record<string, string> = {};
  if (tag && tag !== "all") {
    params.tag = tag;
  }
  if (search && search.trim() !== "") {
    params.search = search.trim();
  }

  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/ai/reports`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
      params,
    }
  );
  return response.data;
}

async function uploadVaultFile(classroomId: string, formData: FormData) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/ai/reports/upload`,
    formData,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}

async function deleteVaultFile(classroomId: string, reportId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/ai/reports/${reportId}`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

// Fetch helper to stream response chunks
async function streamChat(
  classroomId: string,
  prompt: string,
  onChunk: (chunk: { text?: string; result?: any; error?: string }) => void
) {
  const headers = {
    ...(await TokenHandler.getHeaders()),
    "x-classroom": classroomId,
  };
  
  const response = await fetch(`${API_HOST}/${API_VERSION}/ai/chat`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");

  if (!reader) {
    throw new Error("ReadableStream not supported by browser");
  }

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    // Process SSE format: 'data: {...}\n\n'
    const lines = buffer.split("\n\n");
    // Keep the last partial segment in buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") {
          return;
        }
        try {
          const parsed = JSON.parse(dataStr);
          onChunk(parsed);
        } catch (e) {
          console.warn("Error parsing chunk:", e, "Line was:", line);
        }
      }
    }
  }
}

async function getAutomationTasks(classroomId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/ai/automation-tasks`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function createAutomationTask(classroomId: string, data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/ai/automation-tasks`,
    data,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function updateAutomationTask(classroomId: string, id: string, data: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/ai/automation-tasks/${id}`,
    data,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function deleteAutomationTask(classroomId: string, id: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/ai/automation-tasks/${id}`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

const aiService = {
  getChatHistory,
  getClassroomReports,
  uploadVaultFile,
  deleteVaultFile,
  streamChat,
  getAutomationTasks,
  createAutomationTask,
  updateAutomationTask,
  deleteAutomationTask,
};

export default aiService;
