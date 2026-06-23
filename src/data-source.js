import https from "node:https";

const COINLORE_TICKERS_ENDPOINT = "https://api.coinlore.net/api/tickers/";
const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "TRX"];
const ASSET_ALIASES = new Map([
  ["btc", "BTC"],
  ["bitcoin", "BTC"],
  ["eth", "ETH"],
  ["ethereum", "ETH"],
  ["sol", "SOL"],
  ["solana", "SOL"],
  ["xrp", "XRP"],
  ["ripple", "XRP"],
  ["bnb", "BNB"],
  ["binance", "BNB"],
  ["doge", "DOGE"],
  ["dogecoin", "DOGE"],
  ["ada", "ADA"],
  ["cardano", "ADA"],
  ["trx", "TRX"],
  ["tron", "TRX"],
  ["avax", "AVAX"],
  ["avalanche", "AVAX"],
  ["link", "LINK"],
  ["chainlink", "LINK"],
  ["dot", "DOT"],
  ["polkadot", "DOT"],
  ["matic", "MATIC"],
  ["polygon", "MATIC"]
]);

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "User-Agent": "athena-interview-agent/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`CoinLore request failed with ${response.status}`);
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
              reject(new Error(`CoinLore request failed with ${response.statusCode || "unknown status"}`));
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

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
  return "24h";
}

function extractSymbols(query = "", assets = "") {
  const raw = `${assets} ${query}`.toLowerCase();
  const symbols = [];

  for (const [alias, symbol] of ASSET_ALIASES.entries()) {
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(raw) && !symbols.includes(symbol)) {
      symbols.push(symbol);
    }
  }

  return symbols.length ? symbols.slice(0, 12) : DEFAULT_SYMBOLS;
}

function changeForTimeframe(record, timeframe) {
  if (timeframe === "1h") return toNumber(record.percent_change_1h);
  if (timeframe === "7d") return toNumber(record.percent_change_7d);
  return toNumber(record.percent_change_24h);
}

export async function searchPublicData({ query = "", assets = "", timeframe = "24h", limit = 8 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 50);
  const selectedTimeframe = normalizeTimeframe(timeframe, query);
  const selectedSymbols = extractSymbols(query, assets);
  const params = new URLSearchParams({
    start: "0",
    limit: "100"
  });
  const sourceUrl = `${COINLORE_TICKERS_ENDPOINT}?${params.toString()}`;
  const payload = await fetchJson(sourceUrl);
  const records = (payload.data || []).filter((record) => selectedSymbols.includes(String(record.symbol || "").toUpperCase()));

  const items = records.slice(0, safeLimit).map((record) => {
    const price = toNumber(record.price_usd);
    const marketCap = toNumber(record.market_cap_usd);
    const volume = toNumber(record.volume24);
    const change = changeForTimeframe(record, selectedTimeframe);
    const symbol = String(record.symbol || "").toUpperCase();

    return {
      id: String(record.id || symbol),
      title: `${record.name} (${symbol})`,
      subtitle: `Rank #${record.rank || "n/a"} | Price ${compactCurrency(price)}`,
      category: (change || 0) >= 0 ? "Gainer" : "Decliner",
      value: `${formatPercent(change)} ${selectedTimeframe} | Vol ${compactCurrency(volume)}`,
      url: `https://www.coinlore.com/coin/${record.nameid || symbol.toLowerCase()}`,
      updatedAt: new Date().toISOString(),
      symbol,
      price,
      marketCap,
      volume,
      rank: toNumber(record.rank),
      timeframe: selectedTimeframe,
      priceChangePercentage: change,
      marketCapDisplay: compactCurrency(marketCap),
      volumeDisplay: compactCurrency(volume),
      priceDisplay: compactCurrency(price),
      volumeRankLabel: `${compactNumber(volume)} traded`
    };
  });

  return {
    subject: `Crypto Market Monitor (${selectedTimeframe})`,
    sourceName: "CoinLore Public Cryptocurrency API",
    sourceUrl,
    query,
    timeframe: selectedTimeframe,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}
