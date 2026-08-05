import TokenHandler from "./base";
import { API_HOST, API_VERSION } from "../config";
import axios from "axios";

async function getAll() {
  const response = await axios.get(`${API_HOST}/${API_VERSION}/notifications`, {
    headers: await TokenHandler.getHeaders(),
  });
  return response.data;
}

async function getWeb() {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/notifications/web`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function getUnreadCount() {
  const response = await axios.get(
    `${API_HOST}/${API_VERSION}/notifications/unread-count`,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function create(data: any) {
  const response = await axios.post(
    `${API_HOST}/${API_VERSION}/notifications`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function updateAllStatus(data: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/notifications/status`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

async function updateStatus(id: string, data: any) {
  const response = await axios.put(
    `${API_HOST}/${API_VERSION}/notifications/${id}`,
    data,
    {
      headers: await TokenHandler.getHeaders(),
    }
  );
  return response.data;
}

const notificationsService = {
  getAll,
  getWeb,
  getUnreadCount,
  create,
  updateAllStatus,
  updateStatus,
};

export default notificationsService;
