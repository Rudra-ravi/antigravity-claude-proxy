# Antigravity MCP Tools

MCP (Model Context Protocol) servers that extend the Antigravity Claude Proxy with additional capabilities.

## Available Tools

### 🖼️ Image Generation Server (`image-server.js`)

Generate and edit images using Gemini 3 Pro Image model.

**Tools:**
- `generate_image` - Create images from text prompts
- `edit_image` - Edit existing images with AI

**Features:**
- Multiple aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
- Automatic image saving to `~/.config/antigravity-proxy/images/`
- Base64 image input/output support

### 🔍 Web Search Server (`search-server.js`)

Search the web using Gemini with Google Search grounding.

**Tools:**
- `web_search` - General web search with source citations
- `search_news` - Search recent news with time range filtering

**Features:**
- Real-time web results via Google Search
- Source URLs and citations
- News filtering by time range (1h, 24h, 7d, 30d)

## Installation

```bash
cd mcp-tools
npm install
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTIGRAVITY_PROXY_URL` | `http://localhost:8080` | Antigravity proxy URL |
| `ANTIGRAVITY_API_KEY` | `test` | API key for proxy authentication |
| `IMAGE_OUTPUT_DIR` | `~/.config/antigravity-proxy/images` | Directory for saved images |

### Claude Code Configuration

Add to your Claude Code MCP settings (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "antigravity-image": {
      "command": "node",
      "args": ["/path/to/mcp-tools/image-server.js"],
      "env": {
        "ANTIGRAVITY_PROXY_URL": "http://localhost:8080"
      }
    },
    "antigravity-search": {
      "command": "node",
      "args": ["/path/to/mcp-tools/search-server.js"],
      "env": {
        "ANTIGRAVITY_PROXY_URL": "http://localhost:8080"
      }
    }
  }
}
```

### Antigravity IDE Configuration

Add to `~/.config/Antigravity/User/mcp.json`:

```json
{
  "servers": {
    "antigravity-image": {
      "command": "node",
      "args": ["/path/to/mcp-tools/image-server.js"],
      "env": {
        "ANTIGRAVITY_PROXY_URL": "http://localhost:8080"
      },
      "type": "stdio"
    },
    "antigravity-search": {
      "command": "node",
      "args": ["/path/to/mcp-tools/search-server.js"],
      "env": {
        "ANTIGRAVITY_PROXY_URL": "http://localhost:8080"
      },
      "type": "stdio"
    }
  }
}
```

## Usage Examples

### Image Generation

```
User: Generate an image of a futuristic city at sunset
Tool: generate_image(prompt="A futuristic city at sunset with flying cars and neon lights")
```

### Web Search

```
User: Search for the latest news about AI
Tool: search_news(query="artificial intelligence", time_range="24h")
```

## Running Standalone

```bash
# Start image server
npm run start:image

# Start search server
npm run start:search
```

## Requirements

- Node.js 18+
- Antigravity Claude Proxy running on configured URL
- For image generation: Access to `gemini-3-pro-image` model
- For web search: Access to `gemini-3-flash` model with Google Search grounding

## License

MIT
