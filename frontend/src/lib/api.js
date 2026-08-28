import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKENS = {
  get access() { return localStorage.getItem("gb_access"); },
  get refresh() { return localStorage.getItem("gb_refresh"); },
  set(access, refresh) {
    if (access) localStorage.setItem("gb_access", access);
    if (refresh) localStorage.setItem("gb_refresh", refresh);
  },
  clear() { localStorage.removeItem("gb_access"); localStorage.removeItem("gb_refresh"); },
};
export { TOKENS };

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const t = TOKENS.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && TOKENS.refresh) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post(`${API}/auth/refresh`, { refresh_token: TOKENS.refresh });
        const { data } = await refreshing;
        refreshing = null;
        TOKENS.set(data.access_token, data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        TOKENS.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// SSE streaming for the AI workspace prompt
export async function streamPrompt(body, onEvent, signal) {
  const res = await fetch(`${API}/workspace/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKENS.access}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data:")) {
        try { onEvent(JSON.parse(line.slice(5).trim())); } catch (_) {}
      }
    }
  }
}
