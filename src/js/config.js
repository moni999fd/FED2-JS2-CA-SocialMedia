export const BASE = "https://v2.api.noroff.dev";


const LS_TOKEN = "accessToken";
const LS_API_KEY = "apiKey";


export function getToken() {
  return localStorage.getItem(LS_TOKEN);
}


export function getApiKey() {
  return localStorage.getItem(LS_API_KEY);
}


function setApiKey(key) {
  localStorage.setItem(LS_API_KEY, key);
}


async function createApiKey(token) {
  const res = await fetch(`${BASE}/auth/create-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },

  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      payload?.errors?.[0]?.message ||
      payload?.message ||
      `Failed to create API key (HTTP ${res.status})`;
    throw new Error(msg);
  }

  
  return payload?.data?.key;
}


export async function ensureApiKey() {
  const existing = getApiKey();
  if (existing) return existing;

  const token = getToken();
  if (!token) throw new Error("Missing access token. Please log in.");

  const key = await createApiKey(token);
  setApiKey(key);
  return key;
}
