#!/usr/bin/env node
/**
 * Antigravity Image Generation MCP Server
 * Uses gemini-3-pro-image model via the Antigravity proxy
 * 
 * Features:
 * - Generate images from text prompts
 * - Edit existing images with AI
 * - Multiple aspect ratio support
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROXY_URL = process.env.ANTIGRAVITY_PROXY_URL || 'http://localhost:8080';
const OUTPUT_DIR = process.env.IMAGE_OUTPUT_DIR || join(homedir(), '.config', 'antigravity-proxy', 'images');

// Log to stderr to avoid interfering with MCP JSON-RPC on stdout
const log = (msg) => console.error(`[antigravity-image-mcp] ${msg}`);

// Ensure output directory exists
try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
} catch (e) {
  // Ignore if exists
}

async function generateImage(prompt, aspectRatio = '1:1') {
  log(`Generating image: "${prompt}" (${aspectRatio})`);
  
  const response = await fetch(`${PROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTIGRAVITY_API_KEY || 'test',
    },
    body: JSON.stringify({
      model: 'gemini-3-pro-image',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `Generate an image: ${prompt}

Aspect ratio: ${aspectRatio}
Style: High quality, detailed, professional
Please create this image.`
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proxy error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Look for image content in response
  let imageData = null;
  let textResponse = '';
  
  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'image' && block.source?.data) {
        imageData = block.source.data;
      } else if (block.type === 'text') {
        textResponse += block.text;
      }
    }
  }

  if (imageData) {
    // Save image to file
    const timestamp = Date.now();
    const filename = `image_${timestamp}.png`;
    const filepath = join(OUTPUT_DIR, filename);
    
    const buffer = Buffer.from(imageData, 'base64');
    writeFileSync(filepath, buffer);
    
    log(`Image saved to: ${filepath}`);
    
    return {
      success: true,
      filepath: filepath,
      message: `Image generated and saved to: ${filepath}`,
      base64: imageData.substring(0, 100) + '...' // Truncated for display
    };
  }

  // If no image data, return the text response
  return {
    success: false,
    message: textResponse || 'Image generation completed but no image data returned. The model may have provided a text description instead.',
    filepath: null
  };
}

async function editImage(baseImage, editPrompt, aspectRatio = '1:1') {
  log(`Editing image with prompt: "${editPrompt}"`);
  
  const response = await fetch(`${PROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTIGRAVITY_API_KEY || 'test',
    },
    body: JSON.stringify({
      model: 'gemini-3-pro-image',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: baseImage,
              },
            },
            {
              type: 'text',
              text: `Edit this image: ${editPrompt}\n\nAspect ratio: ${aspectRatio}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proxy error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Look for image content in response
  let imageData = null;
  let textResponse = '';
  
  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'image' && block.source?.data) {
        imageData = block.source.data;
      } else if (block.type === 'text') {
        textResponse += block.text;
      }
    }
  }

  if (imageData) {
    const timestamp = Date.now();
    const filename = `edited_${timestamp}.png`;
    const filepath = join(OUTPUT_DIR, filename);
    
    const buffer = Buffer.from(imageData, 'base64');
    writeFileSync(filepath, buffer);
    
    log(`Edited image saved to: ${filepath}`);
    
    return {
      success: true,
      filepath: filepath,
      message: `Image edited and saved to: ${filepath}`,
    };
  }

  return {
    success: false,
    message: textResponse || 'Image edit completed but no image data returned.',
    filepath: null
  };
}

const server = new Server(
  {
    name: 'antigravity-image-mcp',
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
        name: 'generate_image',
        description: 'Generate an image using Gemini 3 Pro Image model via Antigravity proxy. Images are saved to ~/.config/antigravity-proxy/images/',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Detailed description of the image to generate',
            },
            aspect_ratio: {
              type: 'string',
              description: 'Aspect ratio for the image',
              enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
              default: '1:1',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'edit_image',
        description: 'Edit an existing image using AI. Provide base64 image data and edit instructions.',
        inputSchema: {
          type: 'object',
          properties: {
            base_image: {
              type: 'string',
              description: 'Base64-encoded image data to edit',
            },
            edit_prompt: {
              type: 'string',
              description: 'Description of the edits to apply',
            },
            aspect_ratio: {
              type: 'string',
              description: 'Aspect ratio for the output image',
              enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
              default: '1:1',
            },
          },
          required: ['base_image', 'edit_prompt'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'generate_image') {
    try {
      const result = await generateImage(args.prompt, args.aspect_ratio || '1:1');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      log(`Error: ${error.message}`);
      return {
        content: [
          {
            type: 'text',
            text: `Image generation failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === 'edit_image') {
    try {
      const result = await editImage(args.base_image, args.edit_prompt, args.aspect_ratio || '1:1');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      log(`Error: ${error.message}`);
      return {
        content: [
          {
            type: 'text',
            text: `Image edit failed: ${error.message}`,
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
  log('Starting image generation MCP server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Server connected');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
