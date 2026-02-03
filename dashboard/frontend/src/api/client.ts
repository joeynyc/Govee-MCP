import type { Device, RgbColor } from "./types";

const API_BASE = "/api";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getDevices(): Promise<Device[]> {
  return fetchApi<Device[]>("/devices");
}

export async function setPower(
  deviceId: string,
  model: string,
  on: boolean
): Promise<void> {
  await fetchApi(`/devices/${encodeURIComponent(deviceId)}/power`, {
    method: "POST",
    body: JSON.stringify({ model, on }),
  });
}

export async function setBrightness(
  deviceId: string,
  model: string,
  percent: number
): Promise<void> {
  await fetchApi(`/devices/${encodeURIComponent(deviceId)}/brightness`, {
    method: "POST",
    body: JSON.stringify({ model, percent }),
  });
}

export async function setColor(
  deviceId: string,
  model: string,
  color: RgbColor
): Promise<void> {
  await fetchApi(`/devices/${encodeURIComponent(deviceId)}/color`, {
    method: "POST",
    body: JSON.stringify({ model, ...color }),
  });
}

export async function setColorTemp(
  deviceId: string,
  model: string,
  kelvin: number
): Promise<void> {
  await fetchApi(`/devices/${encodeURIComponent(deviceId)}/color-temp`, {
    method: "POST",
    body: JSON.stringify({ model, kelvin }),
  });
}
