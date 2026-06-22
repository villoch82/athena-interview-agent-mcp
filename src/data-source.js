import https from "node:https";

const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "athena-interview-agent/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return response.json();
  } catch (error) {
    return new Promise((resolve, reject) => {
      https
        .get(url, { headers: { "User-Agent": "athena-interview-agent/0.1" } }, (response) => {
          let body = "";

          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
              reject(new Error(`Request failed with ${response.statusCode || "unknown status"}`));
              return;
            }

            try {
              resolve(JSON.parse(body));
            } catch (parseError) {
              reject(parseError);
            }
          });
        })
        .on("error", () => {
          reject(error);
        });
    });
  }
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatMagnitude(value) {
  return typeof value === "number" ? `M ${value.toFixed(1)}` : "Magnitude unknown";
}

function classifyDepth(kilometers) {
  if (typeof kilometers !== "number") return "Depth unknown";
  if (kilometers < 70) return "Shallow";
  if (kilometers < 300) return "Intermediate";
  return "Deep";
}

export async function searchPublicData({ query = "", limit = 12 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const normalizedQuery = query.trim();
  const minimumMagnitude = Number.parseFloat(normalizedQuery);
  const startDate = toIsoDate(new Date(Date.now() - ONE_WEEK_MS));
  const params = new URLSearchParams({
    format: "geojson",
    starttime: startDate,
    orderby: "time",
    limit: String(Math.max(safeLimit * 3, safeLimit))
  });

  if (Number.isFinite(minimumMagnitude)) {
    params.set("minmagnitude", String(minimumMagnitude));
  } else {
    params.set("minmagnitude", "2.5");
  }

  const sourceUrl = `${USGS_ENDPOINT}?${params.toString()}`;
  const payload = await fetchJson(sourceUrl);
  const queryText = normalizedQuery.toLowerCase();
  const filteredFeatures = (payload.features || []).filter((feature) => {
    if (!queryText || Number.isFinite(minimumMagnitude)) return true;
    return String(feature.properties?.place || "").toLowerCase().includes(queryText);
  });

  const items = filteredFeatures.slice(0, safeLimit).map((feature) => {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    const depth = coordinates[2];
    const place = properties.place || "Unknown location";
    const time = properties.time ? new Date(properties.time).toISOString() : new Date().toISOString();

    return {
      id: String(feature.id || `${place}-${time}`),
      title: `${formatMagnitude(properties.mag)} earthquake`,
      subtitle: place,
      category: classifyDepth(depth),
      value: `${formatMagnitude(properties.mag)} | ${typeof depth === "number" ? `${depth.toFixed(1)} km deep` : "Depth unknown"}`,
      url: properties.url || "https://earthquake.usgs.gov/earthquakes/search/",
      updatedAt: time
    };
  });

  return {
    subject: "Recent USGS Earthquakes",
    sourceName: "USGS Earthquake Catalog",
    sourceUrl,
    query,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}
