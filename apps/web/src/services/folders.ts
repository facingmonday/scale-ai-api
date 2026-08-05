import axios from "axios";
import { API_HOST, API_VERSION } from "../config";
import TokenHandler from "./base";

async function fetchAll() {
  const url = new URL(`${API_HOST}/${API_VERSION}/folders`);
  const response = await axios.get(url.toString(), {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function fetch(id: string) {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/folders/${id}`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function create(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/folders`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function update(id: string, data: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/folders/${id}`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function remove(id: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/folders/${id}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function upload(file: any) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/folders/upload`,
    formData,
    {
      headers: {
        ...(await TokenHandler.getHeaders()),
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}

const foldersService = {
  fetch,
  fetchAll,
  create,
  update,
  remove,
  upload,
};

export default foldersService;
