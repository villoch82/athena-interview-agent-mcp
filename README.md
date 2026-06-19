# Athena AI Interview Agent

Starter MCP server and embedded widget for the timed Athena challenge.

## Run

```bash
npm install
npm run dev
```

The MCP endpoint defaults to:

```text
http://localhost:3000/mcp
```

For Athena, expose it with a tunnel and use the public `/mcp` URL.

```bash
npm run tunnel
```

If using localtunnel, the MCP URL will be the public tunnel URL with `/mcp` appended.

## Files

- `src/server.js` - MCP server, tool registration, widget resource
- `src/data-source.js` - public data fetch/normalization layer to adapt to the assigned topic
- `src/widget.html` - embedded interactive widget
