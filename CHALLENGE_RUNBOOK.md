# Athena Timed Challenge Runbook

Use this when the topic is revealed. Keep the Render service and Athena agent URL stable; change only the data source and topic-specific copy.

## First 5 minutes

1. Read the assigned topic twice.
2. Pick a public JSON source that needs no login or API key.
3. Test the endpoint with `curl`.
4. Identify 5-7 fields users can inspect in the widget.
5. Decide one natural search/filter argument for `query`.

Good source qualities:

- public HTTPS JSON
- no API key
- simple result array
- stable official or well-known provider
- includes source URLs per record

## Files to edit

- `src/data-source.js`
  - Replace endpoint constants.
  - Fetch real data.
  - Normalize records into `items`.
  - Update `subject`, `sourceName`, and `sourceUrl`.

- `src/server.js`
  - Update tool `title`.
  - Update tool `description`.
  - Update invocation labels.
  - Keep `openai/outputTemplate`, `outputSchema`, `annotations`, and `_meta`.

- `src/widget.html`
  - Usually leave as-is.
  - Only tweak labels/colors if the topic needs clearer wording.

## Required item shape

```js
{
  id: "stable-id",
  title: "Primary label",
  subtitle: "Human-readable context",
  category: "Group/type/status",
  value: "Short important value",
  url: "https://source.example/record",
  updatedAt: "2026-06-22T00:00:00.000Z"
}
```

## Fast public source ideas

- Earthquakes: USGS Earthquake Catalog
- Weather: Open-Meteo or National Weather Service alerts
- Books: Open Library Search API
- Countries: REST Countries
- Space: NASA public APIs or Open Notify-style endpoints
- Economics: World Bank API
- Civic/local data: Socrata open data portals
- Art/culture: Metropolitan Museum of Art Collection API

## Local validation

Start server:

```bash
npm run dev
```

List tools:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Call tool:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_public_data","arguments":{"query":"","limit":8}}}'
```

Read widget resource:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"ui://widget/public-data.html"}}'
```

## Deploy loop

1. Commit changes.
2. Push from VSCode.
3. Wait for Render deploy.
4. Test:

```bash
curl -s -X POST https://athena-interview-agent-mcp.onrender.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

5. Refresh connector in Athena or create a new chat/agent if Athena caches metadata.

## Athena agent prompt

```text
Use the connected MCP tool to retrieve real public data for the assigned topic. Always render results using the embedded widget. Do not list all records in the chat response when the widget is shown. Provide only a brief summary, mention the public source, and invite the user to interact with the widget.
```

## Demo video checklist

Show all of these in under 1 minute:

1. Athena agent page.
2. Prompt asking for real data.
3. Widget appears embedded in Athena.
4. Mention or visible source name.
5. Interact with widget:
   - type in filter
   - change sort
   - click/expand a card
6. Keep MCP URL and repo link ready for final message.

## Final submission fields

- Demo video uploaded directly as `.mp4` or `.MOV`
- MCP URL: `https://athena-interview-agent-mcp.onrender.com/mcp`
- Athena agent link
- GitHub repository link

