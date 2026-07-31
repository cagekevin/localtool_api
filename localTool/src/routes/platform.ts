/**
 * 平台路由 — /plugin/*、/api/workflow-apps/*、/public/platform/*
 * 本地模式返回静态兜底数据
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, sendError } from '../utils/helpers.js';

// ── GET /plugin/manifest.json ──
export async function handlePluginManifest(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 本地模式返回当前版本，不触发更新提示
  return json(res, {
    version: '1.4.2',
    hasUpdate: false,
  });
}

// ── GET /api/workflow-apps/by-project/:projectId ──
export async function handleWorkflowAppsByProject(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  // 本地模式无工作流应用，返回 null
  return json(res, {
    success: true,
    data: null,
    _meta: { stub: true, message: '工作流应用市场功能后续补齐，当前仅支持本地项目工作流' },
  });
}

// ── 内置模型清单（来自 apimart-gateway Lovart 模型定义，main.py:65-101）──
// Lovart 新增模型时同步更新此处（改 model 时顺手改，保持两份一致）。
// 本地模式无远端中心服务，返回静态清单兜底，避免前端 404 后静默回退到空列表。

const BUILTIN_MODELS = {
  // 文生图模型（来自 main.py _IMAGE_RULES）
  image: [
    'gpt-image-2-low', 'gpt-image-2-medium', 'gpt-image-2-high',
    'gpt-image-2', 'gpt-image-1.5',
    'nano-banana-pro', 'nano-banana-2', 'nano-banana',
    'seedream-5', 'seedream-4.5', 'seedream-4',
    'imagen-4', 'flux.2-max', 'flux.2-pro',
    'luma-uni-1-max', 'luma-uni-1', 'midjourney',
  ],
  // 文生视频模型（来自 main.py _VIDEO_RULES）
  video: [
    'seedance-2.0-fast', 'seedance-2', 'seedance-1.5',
    'kling-v3-omni', 'kling-v3', 'kling-v2.6', 'kling-o1', 'kling',
    'veo3.1-fast', 'veo3.1', 'veo3',
    'sora-2-pro', 'sora-2',
    'wan-2.6', 'hailuo-2.3', 'vidu-q2',
  ],
  // 特惠视频与普通视频共享同一套 Lovart 模型
  discountVideo: [
    'seedance-2.0-fast', 'seedance-2', 'seedance-1.5',
    'kling-v3-omni', 'kling-v3', 'kling-v2.6', 'kling-o1',
    'veo3.1-fast', 'veo3.1', 'veo3',
    'sora-2-pro', 'sora-2',
    'wan-2.6', 'hailuo-2.3', 'vidu-q2',
  ],
  text: [],
  discountVideoSpecs: {} as Record<string, unknown>,
  power: {}, unit: {}, currency: {}, recommended: {}, descriptions: {},
};

const BUILTIN_MODEL_SERIES: Array<{ name: string; seriesKey: string; seriesLabel: string }> = [
  { name: 'seedance-2.0-fast', seriesKey: 'seedance', seriesLabel: 'Seedance 系列' },
  { name: 'seedance-2', seriesKey: 'seedance', seriesLabel: 'Seedance 系列' },
  { name: 'seedance-1.5', seriesKey: 'seedance', seriesLabel: 'Seedance 系列' },
  { name: 'kling-v3-omni', seriesKey: 'kling', seriesLabel: 'Kling 系列' },
  { name: 'kling-v3', seriesKey: 'kling', seriesLabel: 'Kling 系列' },
  { name: 'kling-v2.6', seriesKey: 'kling', seriesLabel: 'Kling 系列' },
  { name: 'kling-o1', seriesKey: 'kling', seriesLabel: 'Kling 系列' },
  { name: 'kling', seriesKey: 'kling', seriesLabel: 'Kling 系列' },
  { name: 'veo3.1-fast', seriesKey: 'veo', seriesLabel: 'Veo 系列' },
  { name: 'veo3.1', seriesKey: 'veo', seriesLabel: 'Veo 系列' },
  { name: 'veo3', seriesKey: 'veo', seriesLabel: 'Veo 系列' },
  { name: 'sora-2-pro', seriesKey: 'sora', seriesLabel: 'Sora 系列' },
  { name: 'sora-2', seriesKey: 'sora', seriesLabel: 'Sora 系列' },
  { name: 'wan-2.6', seriesKey: 'wan', seriesLabel: 'Wan 系列' },
  { name: 'hailuo-2.3', seriesKey: 'hailuo', seriesLabel: 'Hailuo 系列' },
  { name: 'vidu-q2', seriesKey: 'vidu', seriesLabel: 'Vidu 系列' },
  { name: 'gpt-image-2-low', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'gpt-image-2-medium', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'gpt-image-2-high', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'gpt-image-2', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'gpt-image-1.5', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'nano-banana-pro', seriesKey: 'nano-banana', seriesLabel: 'Nano Banana 系列' },
  { name: 'nano-banana-2', seriesKey: 'nano-banana', seriesLabel: 'Nano Banana 系列' },
  { name: 'nano-banana', seriesKey: 'nano-banana', seriesLabel: 'Nano Banana 系列' },
  { name: 'seedream-5', seriesKey: 'seedream', seriesLabel: 'Seedream 系列' },
  { name: 'seedream-4.5', seriesKey: 'seedream', seriesLabel: 'Seedream 系列' },
  { name: 'seedream-4', seriesKey: 'seedream', seriesLabel: 'Seedream 系列' },
  { name: 'imagen-4', seriesKey: 'imagen', seriesLabel: 'Imagen 系列' },
  { name: 'flux.2-max', seriesKey: 'flux', seriesLabel: 'Flux 系列' },
  { name: 'flux.2-pro', seriesKey: 'flux', seriesLabel: 'Flux 系列' },
  { name: 'luma-uni-1-max', seriesKey: 'luma', seriesLabel: 'Luma 系列' },
  { name: 'luma-uni-1', seriesKey: 'luma', seriesLabel: 'Luma 系列' },
  { name: 'midjourney', seriesKey: 'midjourney', seriesLabel: 'Midjourney 系列' },
];

// ── GET /public/platform/builtin ──
// 前端 fetchBuiltin（httpClient-BknZwXjG.js）拉取内置模型分类清单
// 期望格式: { success: true, data: { image:[], video:[], discountVideo:[], discountVideoSpecs:{}, ... } }
export async function handleBuiltin(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, { success: true, data: BUILTIN_MODELS });
}

// ── GET /public/platform/models ──
// 前端 Xi()（httpClient-BknZwXjG.js）拉取模型系列映射
// 期望格式: { success: true, data: [{ name, seriesKey, seriesLabel }, ...] }
export async function handleModels(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, { success: true, data: BUILTIN_MODEL_SERIES });
}
