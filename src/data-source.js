import https from "node:https";

const COINGECKO_MARKETS_ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets";
const DEFAULT_ASSET_IDS = ["bitcoin", "ethereum", "solana", "ripple", "binancecoin", "dogecoin", "cardano", "tron"];
const ASSET_ALIASES = new Map([
  ["btc", "bitcoin"],
  ["bitcoin", "bitcoin"],
  ["eth", "ethereum"],
  ["ethereum", "ethereum"],
  ["sol", "solana"],
  ["solana", "solana"],
  ["xrp", "ripple"],
  ["ripple", "ripple"],
  ["bnb", "binancecoin"],
  ["binance", "binancecoin"],
  ["doge", "dogecoin"],
  ["dogecoin", "dogecoin"],
  ["ada", "cardano"],
  ["cardano", "cardano"],
  ["trx", "tron"],
  ["tron", "tron"],
  ["avax", "avalanche-2"],
  ["avalanche", "avalanche-2"],
  ["link", "chainlink"],
  ["chainlink", "chainlink"],
  ["dot", "polkadot"],
  ["polkadot", "polkadot"],
  ["matic", "polygon"],
  ["polygon", "polygon"]
]);
const TIMEFRAMES = new Set(["1h", "24h", "7d", "30d"]);

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "User-Agent": "athena-interview-agent/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko request failed with ${response.status}`);
    }

    return response.json();
  } catch (error) {
    return new Promise((resolve, reject) => {
      https
        .get(url, { headers: { accept: "application/json", "User-Agent": "athena-interview-agent/0.1" } }, (response) => {
          let body = "";

          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
              reject(new Error(`CoinGecko request failed with ${response.statusCode || "unknown status"}`));
              return;
            }

            try {
              resolve(JSON.parse(body));
            } catch (parseError) {
              reject(parseError);
            }
          });
        })
        .on("error", () => reject(error));
    });
  }
}

function compactCurrency(value) {
  if (typeof value !== "number") return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1 ? 2 : 6
  }).format(value);
}

function compactNumber(value) {
  if (typeof value !== "number") return "n/a";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number") return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function normalizeTimeframe(timeframe = "", query = "") {
  const raw = `${timeframe} ${query}`.toLowerCase();
  if (/\b(1h|1 hour|hour|hourly)\b/.test(raw)) return "1h";
  if (/\b(7d|7 day|week|weekly)\b/.test(raw)) return "7d";
  if (/\b(30d|30 day|month|monthly)\b/.test(raw)) return "30d";
  return "24h";
}

function extractAssetIds(query = "", assets = "") {
  const raw = `${assets} ${query}`.toLowerCase();
  const ids = [];

  for (const [alias, id] of ASSET_ALIASES.entries()) {
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(raw) && !ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids.length ? ids.slice(0, 12) : DEFAULT_ASSET_IDS;
}

function changeForTimeframe(record, timeframe) {
  const key = `price_change_percentage_${timeframe}_in_currency`;
  return typeof record[key] === "number" ? record[key] : record.price_change_percentage_24h;
}

export async function searchPublicData({ query = "", assets = "", timeframe = "24h", limit = 8 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 50);
  const selectedTimeframe = normalizeTimeframe(timeframe, query);
  const ids = extractAssetIds(query, assets);
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: ids.join(","),
    order: "market_cap_desc",
    per_page: String(Math.max(safeLimit, ids.length)),
    page: "1",
    sparkline: "false",
    price_change_percentage: "1h,24h,7d,30d"
  });
  const sourceUrl = `${COINGECKO_MARKETS_ENDPOINT}?${params.toString()}`;
  const records = await fetchJson(sourceUrl);

  const items = records.slice(0, safeLimit).map((record) => {
    const change = changeForTimeframe(record, selectedTimeframe);

    return {
      id: record.id,
      title: `${record.name} (${String(record.symbol || "").toUpperCase()})`,
      subtitle: `Rank #${record.market_cap_rank || "n/a"} | Price ${compactCurrency(record.current_price)}`,
      category: change >= 0 ? "Gainer" : "Decliner",
      value: `${formatPercent(change)} ${selectedTimeframe} | Vol ${compactCurrency(record.total_volume)}`,
      url: `https://www.coingecko.com/en/coins/${record.id}`,
      updatedAt: record.last_updated || new Date().toISOString(),
      symbol: String(record.symbol || "").toUpperCase(),
      price: record.current_price,
      marketCap: record.market_cap,
      volume: record.total_volume,
      rank: record.market_cap_rank,
      timeframe: selectedTimeframe,
      priceChangePercentage: change,
      marketCapDisplay: compactCurrency(record.market_cap),
      volumeDisplay: compactCurrency(record.total_volume),
      priceDisplay: compactCurrency(record.current_price),
      volumeRankLabel: `${compactNumber(record.total_volume)} traded`
    };
  });

  return {
    subject: `Crypto Market Monitor (${selectedTimeframe})`,
    sourceName: "CoinGecko Public Markets API",
    sourceUrl,
    query,
    timeframe: selectedTimeframe,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}
