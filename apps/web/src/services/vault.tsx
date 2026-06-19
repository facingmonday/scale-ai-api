import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

// ================= FILES =================

async function getFiles(classroomId: string, folderId?: string, tagId?: string, search?: string) {
  const params: Record<string, string> = {};
  if (folderId) params.folder = folderId;
  if (tagId && tagId !== "all") params.tag = tagId;
  if (search && search.trim() !== "") params.search = search.trim();

  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/files`,
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

async function uploadFile(classroomId: string, formData: FormData) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/files/upload`,
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

async function updateFile(classroomId: string, fileId: string, body: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/files/${fileId}`,
    body,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function deleteFile(classroomId: string, fileId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/files/${fileId}`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function copyFile(classroomId: string, fileId: string, targetClassroomId: string) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/files/${fileId}/copy`,
    { targetClassroomId },
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

// ================= FOLDERS =================

async function getFolders(classroomId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/folders`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function createFolder(classroomId: string, body: { name: string; description?: string; parent?: string | null; path?: string; type?: string }) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/folders`,
    body,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function deleteFolder(classroomId: string, folderId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/folders/${folderId}`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

// ================= TAGS =================

async function getTags(classroomId: string) {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/tags`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function createTag(classroomId: string, body: { title: string; description?: string; color?: string; type?: string }) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/tags`,
    body,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

async function deleteTag(classroomId: string, tagId: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/tags/${tagId}`,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "x-classroom": classroomId,
      },
    }
  );
  return response.data;
}

const vaultService = {
  getFiles,
  uploadFile,
  updateFile,
  deleteFile,
  copyFile,
  getFolders,
  createFolder,
  deleteFolder,
  getTags,
  createTag,
  deleteTag,
};

export default vaultService;
