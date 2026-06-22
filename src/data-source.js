import https from "node:https";

const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GLOBAL_TERMS = new Set(["world", "the world", "global", "globally", "worldwide", "earth"]);
const TOPIC_ONLY_TERMS = new Set([
  "earthquake",
  "earthquakes",
  "quake",
  "quakes",
  "seismic",
  "seismic activity",
  "earthquake activity",
  "recent earthquakes"
]);

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

function currentYearStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function extractMagnitude(queryText) {
  const matches = queryText.match(/\b\d+(?:\.\d+)?\b/g) || [];
  const magnitude = matches.map(Number).find((value) => value >= 0 && value <= 10);
  return Number.isFinite(magnitude) ? magnitude : undefined;
}

function cleanLocation(value) {
  return value
    .replace(/\b(render|using|with|and|show|the|widget|results?)\b.*$/i, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .trim();
}

function parseQueryIntent(query) {
  const normalizedQuery = query.trim();
  const lowerQuery = normalizedQuery.toLowerCase();
  const asksForYear = /\b(this year|current year|year to date|ytd|2026)\b/.test(lowerQuery);
  const magnitude = extractMagnitude(lowerQuery);
  const inMatch = normalizedQuery.match(/\bin\s+([^,.!?]+)(?:[,.!?]|$)/i);
  const possibleLocation = cleanLocation(inMatch?.[1] || "");
  const locationFromIn = possibleLocation && !GLOBAL_TERMS.has(possibleLocation.toLowerCase()) ? possibleLocation : "";
  const isTopicOnly = TOPIC_ONLY_TERMS.has(lowerQuery) || /^(show|find|get|list)?\s*(recent\s*)?(earthquakes?|quakes?|seismic activity)\s*$/i.test(normalizedQuery);
  const isBroadGlobal =
    !normalizedQuery ||
    GLOBAL_TERMS.has(lowerQuery) ||
    TOPIC_ONLY_TERMS.has(lowerQuery) ||
    /\b(world|global|worldwide)\b/.test(lowerQuery);
  const shouldTreatAsBroad = isBroadGlobal || isTopicOnly;
  const locationQuery = locationFromIn || (!shouldTreatAsBroad && !asksForYear && magnitude === undefined ? normalizedQuery : "");

  return {
    normalizedQuery,
    locationQuery,
    minimumMagnitude: magnitude ?? (asksForYear || shouldTreatAsBroad ? 4.5 : 2.5),
    startDate: asksForYear ? toIsoDate(currentYearStart()) : toIsoDate(new Date(Date.now() - ONE_WEEK_MS)),
    subject: locationQuery
      ? `USGS Earthquakes near ${locationQuery}`
      : asksForYear
        ? "Global USGS Earthquakes This Year"
        : "Recent USGS Earthquakes"
  };
}

export async function searchPublicData({ query = "", limit = 12 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const intent = parseQueryIntent(query);
  const queryLimit = intent.locationQuery ? Math.min(Math.max(safeLimit * 20, 100), 200) : Math.max(safeLimit * 3, safeLimit);
  const params = new URLSearchParams({
    format: "geojson",
    starttime: intent.startDate,
    orderby: "time",
    limit: String(queryLimit),
    minmagnitude: String(intent.minimumMagnitude)
  });

  const sourceUrl = `${USGS_ENDPOINT}?${params.toString()}`;
  const payload = await fetchJson(sourceUrl);
  const queryText = intent.locationQuery.toLowerCase();
  const filteredFeatures = (payload.features || []).filter((feature) => {
    if (!queryText) return true;
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
    subject: intent.subject,
    sourceName: "USGS Earthquake Catalog",
    sourceUrl,
    query,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}
