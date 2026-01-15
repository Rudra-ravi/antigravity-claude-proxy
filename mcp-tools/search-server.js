#!/usr/bin/env node
/**
 * Antigravity Web Search MCP Server
 * Uses Gemini with Google Search grounding via the Antigravity proxy
 * 
 * Features:
 * - Web search with real-time results
 * - Source citations and URLs
 * - Configurable result count
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const PROXY_URL = process.env.ANTIGRAVITY_PROXY_URL || 'http://localhost:8080';

// Log to stderr to avoid interfering with MCP JSON-RPC on stdout
const log = (msg) => console.error(`[antigravity-search-mcp] ${msg}`);

async function searchWeb(query, numResults = 5) {
  log(`Searching: "${query}" (max ${numResults} results)`);
  
  const response = await fetch(`${PROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTIGRAVITY_API_KEY || 'test',
    },
    body: JSON.stringify({
      model: 'gemini-3-flash',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Search the web and provide detailed information about: "${query}"

Please search for the most recent and relevant information. Include:
1. Key facts and information
2. Sources/URLs where you found this information
3. Any relevant dates or updates

Format your response clearly with the information and sources.`
        }
      ],
      // Enable Google Search grounding
      metadata: {
        google_search_retrieval: true
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proxy error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Extract text content from response
  let content = '';
  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      }
    }
  }

  return content || 'No results found';
}

async function searchNews(query, timeRange = '24h') {
  log(`Searching news: "${query}" (${timeRange})`);
  
  const timeDescriptions = {
    '1h': 'the last hour',
    '24h': 'the last 24 hours',
    '7d': 'the last 7 days',
    '30d': 'the last 30 days',
  };
  
  const timeDesc = timeDescriptions[timeRange] || 'recent';
  
  const response = await fetch(`${PROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTIGRAVITY_API_KEY || 'test',
    },
    body: JSON.stringify({
      model: 'gemini-3-flash',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Search for the latest news about: "${query}"

Focus on news articles from ${timeDesc}. Include:
1. Headlines and key developments
2. News sources and publication dates
3. Brief summaries of each article

Format as a news digest with clear sections.`
        }
      ],
      metadata: {
        google_search_retrieval: true
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proxy error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  let content = '';
  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      }
    }
  }

  return content || 'No news found';
}

const server = new Server(
  {
    name: 'antigravity-search-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'web_search',
        description: 'Search the web using Google Search via Antigravity proxy. Returns relevant information with sources.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to look up on the web',
            },
            num_results: {
              type: 'number',
              description: 'Maximum number of results to return (1-10, default 5)',
              minimum: 1,
              maximum: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_news',
        description: 'Search for recent news articles on a topic. Returns headlines, summaries, and sources.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The news topic to search for',
            },
            time_range: {
              type: 'string',
              description: 'Time range for news articles',
              enum: ['1h', '24h', '7d', '30d'],
              default: '24h',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'web_search') {
    try {
      const result = await searchWeb(args.query, args.num_results || 5);
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      log(`Error: ${error.message}`);
      return {
        content: [
          {
            type: 'text',
            text: `Search failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === 'search_news') {
    try {
      const result = await searchNews(args.query, args.time_range || '24h');
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      log(`Error: ${error.message}`);
      return {
        content: [
          {
            type: 'text',
            text: `News search failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  log('Starting web search MCP server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Server connected');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
