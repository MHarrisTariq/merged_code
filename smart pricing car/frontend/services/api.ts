import axios from "axios";

import type { ApiErrorPayload } from "@/types/api";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!baseURL) {
  console.warn("NEXT_PUBLIC_API_BASE_URL is not set.");
}

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status as number | undefined;
    const details = error?.response?.data;
    const message =
      details?.detail?.message ??
      details?.message ??
      error?.message ??
      "Unexpected API error";

    const normalized: ApiErrorPayload = {
      message,
      status,
      details,
    };

    return Promise.reject(normalized);
  }
);
