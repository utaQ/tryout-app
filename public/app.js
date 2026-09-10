const API = {
  async get(url) {
    const res = await fetch('/api' + url);
    if (!res.ok) throw await API._err(res);
    return res.json();
  },
  async post(url, body) {
    const res = await fetch('/api' + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw await API._err(res);
    return res.json();
  },
  async put(url, body) {
    const res = await fetch('/api' + url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw await API._err(res);
    return res.json();
  },
  async patch(url, body) {
    const res = await fetch('/api' + url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw await API._err(res);
    return res.json();
  },
  async del(url) {
    const res = await fetch('/api' + url, { method: 'DELETE' });
    if (!res.ok) throw await API._err(res);
    return res.json();
  },
  async _err(res) {
    try {
      const data = await res.json();
      return new Error(data.error || 'Request failed');
    } catch {
      return new Error('Request failed');
    }
  }
};

// Consistent color -> hex mapping for uniform chips
const UNIFORM_COLORS = {
  green: '#1e7d3c', yellow: '#d4a017', teal: '#0f8b8d', red: '#c0392b',
  blue: '#2255bb', orange: '#d2691e', purple: '#6a3fa0', black: '#222222',
  white: '#888888', pink: '#d6336c', gray: '#6b7280', grey: '#6b7280',
  navy: '#1b2a4a', maroon: '#7a2331'
};

function colorHex(name) {
  if (!name) return '#999';
  return UNIFORM_COLORS[name.trim().toLowerCase()] || '#555';
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
