import { BUILT_IN_DATASETS, sanitizeWorkflowInput } from "../utils/flowEngine.js";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/u, "");
export const API_TIMEOUT_MS = 4000;

export async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Accept: "application/json", ...options.headers }
    });
    if (!response.ok) throw new Error(`Backend request failed with status ${response.status}.`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkBackendConnection() {
  try {
    const health = await requestJson("/api/health");
    return health?.status === "healthy";
  } catch {
    return false;
  }
}

export async function loadOperationalDatasets() {
  try {
    const response = await requestJson("/api/workflow-data");
    return { datasets: sanitizeWorkflowInput(response), source: "Live backend datasets" };
  } catch {
    return {
      datasets: sanitizeWorkflowInput(BUILT_IN_DATASETS),
      source: "Bundled operational datasets"
    };
  }
}

export async function predictWait(payload) {
  return requestJson("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
