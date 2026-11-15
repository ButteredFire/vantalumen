import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

const MAX_DEV_BODY_READ_BYTES = 32 * 1024;

function readRawBody(req: IncomingMessage): Promise<{ exceeded: boolean; bytes: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let exceeded = false;

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalBytes += buf.byteLength;
      if (totalBytes <= MAX_DEV_BODY_READ_BYTES) {
        chunks.push(buf);
      } else {
        exceeded = true;
      }
    });
    req.on('end', () => {
      resolve({
        exceeded,
        bytes: new Uint8Array(Buffer.concat(chunks)),
      });
    });
    req.on('error', reject);
  });
}

function localChatApiDevPlugin(mode: string): Plugin {
  return {
    name: 'vantalumen-local-chat-api',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), 'GEMINI_');
      const allowedEnv = loadEnv(mode, process.cwd(), 'ALLOWED_CHAT_');
      let sharedLimiter: unknown;

      server.middlewares.use('/api/chat', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/api/chat.ts')) as {
            createSlidingWindowLimiter: () => unknown;
            createChatHandler: (deps: {
              getApiKey?: () => string | undefined;
              getAllowedHosts?: () => string[];
              rateLimiter?: unknown;
            }) => (request: Request) => Promise<Response>;
          };
          if (!sharedLimiter) {
            sharedLimiter = mod.createSlidingWindowLimiter();
          }
          const handler = mod.createChatHandler({
            getApiKey: () => env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim(),
            getAllowedHosts: () =>
              (allowedEnv.ALLOWED_CHAT_HOSTS || process.env.ALLOWED_CHAT_HOSTS || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            rateLimiter: sharedLimiter,
          });

          const method = req.method ?? 'GET';
          const host = req.headers.host ?? 'localhost:5173';
          const requestUrl = `http://${host}/api/chat`;
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) headers.append(key, item);
            } else if (typeof value === 'string') {
              headers.set(key, value);
            }
          }

          const hasBody = method !== 'GET' && method !== 'HEAD';
          const rawBodyResult = hasBody ? await readRawBody(req) : null;
          if (rawBodyResult?.exceeded) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(
              JSON.stringify({
                error: 'Kích thước yêu cầu vượt quá giới hạn 16 KB.',
                code: 'PAYLOAD_TOO_LARGE',
              }),
            );
            return;
          }
          const rawBody = rawBodyResult?.bytes;
          const bodyArrayBuffer =
            rawBody && rawBody.byteLength > 0
              ? rawBody.buffer.slice(rawBody.byteOffset, rawBody.byteOffset + rawBody.byteLength)
              : undefined;
          const webRequest = new Request(requestUrl, {
            method,
            headers,
            body: bodyArrayBuffer as ArrayBuffer | undefined,
          });

          const webResponse = await handler(webRequest);
          res.statusCode = webResponse.status;
          webResponse.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          const buf = Buffer.from(await webResponse.arrayBuffer());
          res.end(buf);
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Lỗi dev middleware /api/chat.', code: 'UPSTREAM_ERROR' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), cesium(), localChatApiDevPlugin(mode)],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          postprocessing: ['postprocessing', '@react-three/postprocessing'],
          gsap: ['gsap'],
        },
      },
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
}));
