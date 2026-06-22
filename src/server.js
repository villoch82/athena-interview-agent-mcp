import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { searchPublicData } from "./data-source.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WIDGET_URI = "ui://widget/public-data.html";

const app = express();
app.use(express.json({ limit: "2mb" }));

const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  category: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  updatedAt: z.string().optional()
});

const outputSchema = {
  subject: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  query: z.string(),
  fetchedAt: z.string(),
  count: z.number(),
  items: z.array(itemSchema)
};

async function loadWidgetHtml() {
  return readFile(join(__dirname, "widget.html"), "utf8");
}

function createServer() {
  const server = new McpServer({
    name: "athena-interview-agent",
    version: "0.1.0"
  });

  server.registerResource(
    "public-data-widget",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: "text/html+skybridge",
          text: await loadWidgetHtml(),
          _meta: {
            "openai/widgetDescription": "Renders public data records in a searchable, sortable interactive widget.",
            "openai/widgetPrefersBorder": true
          }
        }
      ]
    })
  );

  server.registerTool(
    "search_public_data",
    {
      title: "Search public data",
      description: "Retrieve real public data for the assigned challenge topic and render it in the embedded widget.",
      inputSchema: {
        query: z.string().optional().describe("Search term or filter supplied by the user."),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum number of records to return.")
      },
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true
      },
      _meta: {
        "openai/outputTemplate": WIDGET_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Retrieving public data...",
        "openai/toolInvocation/invoked": "Public data loaded"
      }
    },
    async ({ query = "", limit = 12 }) => {
      const data = await searchPublicData({ query, limit });

      return {
        structuredContent: data,
        _meta: {
          "openai/outputTemplate": WIDGET_URI
        },
        content: [
          {
            type: "text",
            text: `Retrieved ${data.count} ${data.count === 1 ? "record" : "records"} from ${data.sourceName}.`
          }
        ]
      };
    }
  );

  return server;
}

app.get("/", (_req, res) => {
  res.type("text/plain").send("Athena interview MCP server. Use /mcp as the MCP endpoint.");
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: null
      });
    }
  } finally {
    transport.close();
    server.close();
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST for Streamable HTTP MCP requests."
    },
    id: null
  });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
app.listen(port, host, () => {
  console.log(`MCP server listening on http://${host}:${port}/mcp`);
});
