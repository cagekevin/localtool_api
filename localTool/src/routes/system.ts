/**
 * 子模块 0.5 — 系统/代理路由
 * status / proxy / jianying/send
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, Transform } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { json, parseJsonBody, readRawBody, sendError } from '../utils/helpers.js';

const VERSION = '1.4.2';
const PORT = Number(process.env.PORT) || 18080;
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT) || 300000; // 默认 5min，原硬编码 15s

// ── SSE 协议转换：提取 data: 行，去掉注释心跳，逐 JSON 块输出 ──
function createSSEParserTransform(): Transform {
  let buffer = '';
  return new Transform({
    writableObjectMode: false,
    readableObjectMode: false,
    transform(chunk: Buffer, _encoding, callback) {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      // 最后一个可能是不完整的行，保留在 buffer
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6); // 去掉 "data: "
          if (payload === '[DONE]') continue; // 跳过 SSE 结束标记
          this.push(payload + '\n'); // 每行 JSON 对象
        }
        // 跳过 ": heartbeat" 等注释行和空行
      }
      callback();
    },
    flush(callback) {
      // 处理残留 buffer
      if (buffer.startsWith('data: ') && buffer.slice(6) !== '[DONE]') {
        this.push(buffer.slice(6) + '\n');
      }
      callback();
    },
  });
}

// ── GET /api/status ──
export async function handleStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, {
    status: 'ok',
    version: VERSION,
    message: 'localTool service',
    ffmpeg: false,
    port: PORT,
  });
}

// ── POST /api/proxy ──
export async function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const contentType = req.headers['content-type'] || '';

  // 形态 ①：FormData/Blob body + X-Proxy-* 头
  const proxyUrl = req.headers['x-proxy-url'] as string | undefined;
  if (proxyUrl) {
    return handleProxyFormData(req, res, proxyUrl);
  }

  // 形态 ②：JSON body {url, method, headers, body, cookie}
  if (contentType.includes('application/json')) {
    return handleProxyJson(req, res);
  }

  return sendError(res, 'Invalid proxy request: missing X-Proxy-Url header or JSON body', 400);
}

async function handleProxyFormData(req: IncomingMessage, res: ServerResponse, targetUrl: string): Promise<void> {
  const _proxyStart = Date.now();
  const method = (req.headers['x-proxy-method'] as string) || 'POST';

  let headers: Record<string, string> = {};
  const headersRaw = req.headers['x-proxy-headers'] as string | undefined;
  if (headersRaw) {
    try {
      headers = JSON.parse(headersRaw);
    } catch {
      // ignore
    }
  }

  const cookie = req.headers['x-proxy-cookie'] as string | undefined;
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  // 读取原始 body 并 pipe
  const body = await readRawBody(req);
  if (body.length > 0) {
    headers['Content-Type'] = req.headers['content-type'] || 'application/octet-stream';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    const fetchRes = await fetch(targetUrl, {
      method,
      headers,
      body: body.length > 0 ? body as unknown as BodyInit : undefined,
      signal: controller.signal,
    } as RequestInit);

    clearTimeout(timeout);

    // ── 流式转发：SSE 响应不缓冲，解析 data: 行后逐 JSON 块 pipe ──
    const formResponseCt = fetchRes.headers.get('content-type') || '';
    if (formResponseCt.includes('text/event-stream')) {
      const streamHeaders: Record<string, string> = {};
      const streamSkip = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);
      fetchRes.headers.forEach((value, key) => {
        if (!streamSkip.has(key)) streamHeaders[key] = value;
      });
      // 覆盖 Content-Type，前端收到的是逐行 JSON（非标准 SSE）
      streamHeaders['content-type'] = 'application/x-ndjson';
      res.writeHead(fetchRes.status, streamHeaders);

      let bodyStream = Readable.fromWeb(fetchRes.body as any);
      const ce = fetchRes.headers.get('content-encoding') || '';
      if (ce === 'gzip' || ce === 'x-gzip') bodyStream = bodyStream.pipe(createGunzip());
      else if (ce === 'deflate') bodyStream = bodyStream.pipe(createInflate());
      else if (ce === 'br') bodyStream = bodyStream.pipe(createBrotliDecompress());

      // SSE 解析：提取 data: 行，去掉 : heartbeat 等注释
      const sseParser = createSSEParserTransform();

      bodyStream.on('error', (err: Error) => {
        console.error(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | stream error | ${err.message}`);
        if (!res.writableEnded) res.destroy();
      });

      bodyStream.pipe(sseParser).pipe(res);
      const streamStart = Date.now() - _proxyStart;
      console.log(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${method} ${targetUrl} | ${fetchRes.status} | started in ${streamStart}ms`);
      return;
    }

    const elapsed = Date.now() - _proxyStart;
    const resBody = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${method} ${targetUrl} | ${fetchRes.status} | ${elapsed}ms`);

    // 透传响应头（排除 hop-by-hop）
    const resHeaders: Record<string, string> = {};
    const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
    fetchRes.headers.forEach((value, key) => {
      if (!skipHeaders.has(key)) {
        resHeaders[key] = value;
      }
    });

    res.writeHead(fetchRes.status, resHeaders);
    // 协议翻译：剥 {code, data} 信封，前端直接拿到 data
    let finalBody: Buffer = resBody;
    try {
      const parsed = JSON.parse(resBody.toString('utf-8'));
      if (parsed && typeof parsed === 'object' && 'code' in parsed && 'data' in parsed && !('error' in parsed)) {
        finalBody = Buffer.from(JSON.stringify(parsed.data));
      }
    } catch { /* 非 JSON，原样透传 */ }
    res.end(finalBody);
  } catch (e) {
    const elapsed = Date.now() - _proxyStart;
    const err = e as Error;
    console.error(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${method} ${targetUrl} | ${err.name === 'AbortError' ? 'TIMEOUT' : 'ERR'} | ${elapsed}ms | ${err.message}`);
    if (err.name === 'AbortError') {
      sendError(res, `Proxy request timed out (${PROXY_TIMEOUT_MS / 1000}s)`, 504);
    } else {
      sendError(res, `Proxy request failed: ${err.message}`, 502);
    }
  }
}

async function handleProxyJson(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const _proxyStart = Date.now();
  const body = (await parseJsonBody(req)) as {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    cookie?: string;
  } | null;

  if (!body || !body.url) {
    return sendError(res, 'Missing url in JSON body', 400);
  }

  const headers: Record<string, string> = { ...body.headers };
  if (body.cookie) {
    headers['Cookie'] = body.cookie;
  }

  const fetchBody = (typeof body.body === 'string' && body.body) || undefined;
  if (fetchBody) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    const fetchRes = await fetch(body.url, {
      method: body.method || 'POST',
      headers,
      body: fetchBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // ── 流式转发：SSE 响应不缓冲，解析 data: 行后逐 JSON 块 pipe ──
    const jsonResponseCt = fetchRes.headers.get('content-type') || '';
    if (jsonResponseCt.includes('text/event-stream')) {
      const streamHeaders: Record<string, string> = {};
      const streamSkip = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);
      fetchRes.headers.forEach((value, key) => {
        if (!streamSkip.has(key)) streamHeaders[key] = value;
      });
      streamHeaders['content-type'] = 'application/x-ndjson';
      res.writeHead(fetchRes.status, streamHeaders);

      let bodyStream = Readable.fromWeb(fetchRes.body as any);
      const ce = fetchRes.headers.get('content-encoding') || '';
      if (ce === 'gzip' || ce === 'x-gzip') bodyStream = bodyStream.pipe(createGunzip());
      else if (ce === 'deflate') bodyStream = bodyStream.pipe(createInflate());
      else if (ce === 'br') bodyStream = bodyStream.pipe(createBrotliDecompress());

      const sseParser = createSSEParserTransform();

      bodyStream.on('error', (err: Error) => {
        console.error(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | stream error | ${err.message}`);
        if (!res.writableEnded) res.destroy();
      });

      bodyStream.pipe(sseParser).pipe(res);
      const streamStart = Date.now() - _proxyStart;
      console.log(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${body.method || 'POST'} ${body.url} | ${fetchRes.status} | started in ${streamStart}ms`);
      return;
    }

    const elapsed = Date.now() - _proxyStart;
    const resBody = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${body.method || 'POST'} ${body.url} | ${fetchRes.status} | ${elapsed}ms`);

    const resHeaders: Record<string, string> = {};
    const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
    fetchRes.headers.forEach((value, key) => {
      if (!skipHeaders.has(key)) {
        resHeaders[key] = value;
      }
    });

    res.writeHead(fetchRes.status, resHeaders);
    // 协议翻译：剥 {code, data} 信封，前端直接拿到 data
    let finalBody: Buffer = resBody;
    try {
      const parsed = JSON.parse(resBody.toString('utf-8'));
      if (parsed && typeof parsed === 'object' && 'code' in parsed && 'data' in parsed && !('error' in parsed)) {
        finalBody = Buffer.from(JSON.stringify(parsed.data));
      }
    } catch { /* 非 JSON，原样透传 */ }
    res.end(finalBody);
  } catch (e) {
    const elapsed = Date.now() - _proxyStart;
    const err = e as Error;
    console.error(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${body.method || 'POST'} ${body.url} | ${err.name === 'AbortError' ? 'TIMEOUT' : 'ERR'} | ${elapsed}ms | ${err.message}`);
    if (err.name === 'AbortError') {
      sendError(res, `Proxy request timed out (${PROXY_TIMEOUT_MS / 1000}s)`, 504);
    } else {
      sendError(res, `Proxy request failed: ${err.message}`, 502);
    }
  }
}

// ── POST /api/jianying/send ──
export async function handleJianyingSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) {
    return sendError(res, 'Empty body', 400);
  }

  // 形态 ②：批量 {items: [{fileUrl, localPath}]}
  if (body.items && Array.isArray(body.items)) {
    const items = body.items as Array<{ fileUrl?: string; localPath?: string }>;
    console.log(`[jianying] 批量发送 ${items.length} 个文件到剪映`);

    // 实际剪映集成需要通过剪映的插件 API 或剪映草稿目录
    // 这里记录日志并返回成功
    return json(res, {
      status: 'ok',
      count: items.length,
      message: `${items.length} 个文件已发送到剪映`,
      _meta: { stub: true, message: '剪映发送功能尚未实现，当前仅记录请求（后续补）' },
    });
  }

  // 形态 ①：单个 {fileUrl, localPath, fileName}
  const { fileUrl, localPath, fileName } = body;
  if (!fileUrl && !localPath) {
    return sendError(res, 'Missing fileUrl or localPath', 400);
  }

  console.log(`[jianying] 发送到剪映:`, { fileUrl, localPath, fileName });

  // 实际剪映集成
  return json(res, {
    status: 'ok',
    message: `已发送 ${fileName || '文件'} 到剪映`,
    _meta: { stub: true, message: '剪映发送功能尚未实现，当前仅记录请求（后续补）' },
  });
}
