import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function create(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/members`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getAll() {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/members`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function search(queryParams?: Record<string, any>) {
  const url = new URL(`${API_HOST}/${API_VERSION}/members/search`);
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

async function getStats() {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/members/stats`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getById(id: string) {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/members/${id}`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function update(id: string, data: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/members/${id}`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function remove(id: string) {
  const response = await axios.delete(
    `${API_HOST}/${API_VERSION}/members/${id}`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function updateOrganizationMembership(id: string, data: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/members/${id}/organization-membership`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function addExisting(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/members/add-existing`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const membersService = {
  create,
  getAll,
  search,
  getStats,
  getById,
  update,
  remove,
  updateOrganizationMembership,
  addExisting,
};

export default membersService;
