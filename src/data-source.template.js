// Copy this file over src/data-source.js when the assigned topic is revealed,
// then replace the endpoint, parser, and item mapping.

const PUBLIC_API_ENDPOINT = "https://example.com/api/search";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "athena-interview-agent/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Public data request failed with ${response.status}`);
  }

  return response.json();
}

export async function searchPublicData({ query = "", limit = 12 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(safeLimit)
  });

  const sourceUrl = `${PUBLIC_API_ENDPOINT}?${params.toString()}`;
  const payload = await fetchJson(sourceUrl);

  const records = payload.results || payload.items || [];
  const items = records.slice(0, safeLimit).map((record, index) => ({
    id: String(record.id || index),
    title: String(record.title || record.name || "Untitled record"),
    subtitle: String(record.description || record.summary || ""),
    category: String(record.category || record.type || "Record"),
    value: String(record.value || record.status || "Available"),
    url: String(record.url || sourceUrl),
    updatedAt: record.updatedAt || record.updated_at || new Date().toISOString()
  }));

  return {
    subject: "Assigned Topic Results",
    sourceName: "Public Data Source Name",
    sourceUrl,
    query,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}
