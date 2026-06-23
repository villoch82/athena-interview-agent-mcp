# Athena Crypto Market Monitor

Athena AI Agent MCP server for comparing cryptocurrency assets by price movement, trading volume, market cap, and timeframe.

The server retrieves live public market data from the CoinLore Public Cryptocurrency API and renders the results in an embedded interactive Athena widget.

## Run

```bash
npm install
npm run dev
```

The MCP endpoint defaults to:

```text
http://localhost:3000/mcp
```

Production MCP endpoint:

```text
https://athena-interview-agent-mcp.onrender.com/mcp
```

For local Athena testing, expose the local server with a tunnel and use the public `/mcp` URL.

## Files

- `src/server.js` - MCP server, tool registration, widget resource
- `src/data-source.js` - CoinLore public market data fetch/normalization layer
- `src/widget.html` - embedded interactive crypto comparison widget

## Data Source

- Source: CoinLore Public Cryptocurrency API
- Endpoint: `https://api.coinlore.net/api/tickers/`
- Authentication: none

## Widget Interactions

- Filter visible assets by symbol/name.
- Sort by price movement, volume, market cap, rank, or asset name.
- Click an asset card to expand source and update details.
