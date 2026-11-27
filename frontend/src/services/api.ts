export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

export function getAuthHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function trackActivityApi(
  token: string | null,
  action: string,
  entity_type?: string,
  entity_id?: number,
  details?: string
) {
  fetch(`${API_URL}/api/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(token),
    },
    body: JSON.stringify({ action, entity_type, entity_id, details }),
  }).catch(() => {});
}
