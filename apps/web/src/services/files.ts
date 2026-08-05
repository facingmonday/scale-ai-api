import { API_HOST, API_VERSION } from "../config";
import axios from "axios";
import TokenHandler from "./base";

async function fetchAll(paginationModel: any) {
  const filteredPagination = { ...paginationModel };
  delete filteredPagination.query;
  delete filteredPagination.sort;

  const url = new URL(`${API_HOST}/${API_VERSION}/files`);
  url.search = new URLSearchParams(filteredPagination).toString();

  const response = await axios.get(url.toString(), {
    params: { query: paginationModel.query, sort: paginationModel.sort },
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

export interface UploadFile extends File {
  title?: string;
  createdBy: object;
  createdDate?: string;
  updatedBy: object;
  updatedDate?: string;
  folders?: string[];
}

export const upload = async (
  file: File,
  folderId?: string
): Promise<object> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", "kikits/files");
  if (folderId) {
    formData.append("folder", folderId);
  }
  try {
    const url = `${API_HOST}/${API_VERSION}/files/upload`;
    const response = await axios.post(url, formData, {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "Content-Type": "multipart/form-data",
      },
    });
    if (response.data && response.data.url) {
      return response.data;
    } else {
      throw new Error("File upload failed");
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

async function fetch(id: string) {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/files/${id}`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function createFromUrl(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/files/createFromUrl`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function create(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/files/upload`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function update(id: string, data: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/files/${id}`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function remove(id: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/files/${id}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

export const generate = async ({
  prompt,
  path = "/files/generate",
  size,
  quality = "low",
}: {
  prompt: string;
  path?: string;
  size?: string;
  quality?: "low" | "medium" | "high";
}) => {
  try {
    const response = await axios.post(
      `${API_HOST}/${API_VERSION}/openai/generate`,
      { prompt, path, size, quality },
      {
        headers: await TokenHandler.getHeaders(),
      }
    );
    return response;
  } catch (err) {
    console.error("Error", err);
  }
};

const filesService = {
  fetch,
  fetchAll,
  create,
  update,
  remove,
  upload,
  generate,
  createFromUrl,
};

export default filesService;
