const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

let authToken = localStorage.getItem('fitclash_token') || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) localStorage.setItem('fitclash_token', token);
  else localStorage.removeItem('fitclash_token');
}

export function getAuthToken() {
  return authToken;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Could not reach the server. Is the backend running?');
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  signup: (name, email, password) => request('POST', '/auth/signup', { name, email, password }),
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),
  verifyEmail: (token) => request('POST', '/auth/verify-email', { token }),
  resendVerification: () => request('POST', '/auth/resend-verification'),
  forgotPassword: (email) => request('POST', '/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => request('POST', '/auth/reset-password', { token, new_password }),

  createGroup: (name) => request('POST', '/groups', { name }),
  joinGroup: (invite_code) => request('POST', '/groups/join', { invite_code }),
  myGroups: () => request('GET', '/groups/mine'),
  getGroup: (groupId) => request('GET', `/groups/${groupId}`),
  deleteGroup: (groupId) => request('DELETE', `/groups/${groupId}`),
  removeMember: (groupId, userId) => request('DELETE', `/groups/${groupId}/members/${userId}`),

  renameChallenge: (groupId, name) => request('PUT', `/groups/${groupId}/challenge`, { name }),
  addItem: (groupId, name, points) => request('POST', `/groups/${groupId}/challenge/items`, { name, points }),
  updateItem: (groupId, itemId, name, points) =>
    request('PUT', `/groups/${groupId}/challenge/items/${itemId}`, { name, points }),
  removeItem: (groupId, itemId) => request('DELETE', `/groups/${groupId}/challenge/items/${itemId}`),
  startChallenge: (groupId, name, endDate) =>
    request('POST', `/groups/${groupId}/challenge/start`, { name, end_date: endDate || null }),
  endChallenge: (groupId) => request('POST', `/groups/${groupId}/challenge/end`),

  getTodaySubmission: (groupId) => request('GET', `/groups/${groupId}/submissions/today`),
  submitChecklist: (groupId, completed_item_ids) =>
    request('POST', `/groups/${groupId}/submissions`, { completed_item_ids }),

  getLeaderboard: (groupId, mode) => request('GET', `/groups/${groupId}/leaderboard?mode=${mode}`),

  myStats: () => request('GET', '/users/me/stats'),
  myBadges: () => request('GET', '/users/me/badges'),

  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    let res;
    try {
      res = await fetch(`${API_BASE}/auth/me/avatar`, { method: 'POST', headers, body: form });
    } catch (e) {
      throw new Error('Could not reach the server. Is the backend running?');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.detail) || `Request failed (${res.status})`);
    return data;
  },
  deleteAvatar: () => request('DELETE', '/auth/me/avatar'),
};
