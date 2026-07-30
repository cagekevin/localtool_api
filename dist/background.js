// background.js
// 监听扩展图标点击事件，打开侧边栏
const DEFAULT_LOCAL_TOOL_BASE_URL = 'http://localhost:18080';

const getLocalToolBaseUrl = async () => {
  try {
    const result = await chrome.storage.local.get(['localToolBaseUrl']);
    const value = typeof result?.localToolBaseUrl === 'string' ? result.localToolBaseUrl.trim().replace(/\/$/, '') : '';
    return value || DEFAULT_LOCAL_TOOL_BASE_URL;
  } catch {
    return DEFAULT_LOCAL_TOOL_BASE_URL;
  }
};

chrome.action.onClicked.addListener((tab) => {
  // Chrome 114+ supports opening side panel via action click
  if (tab && tab.windowId && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

// 创建右键菜单的函数
const initContextMenu = () => {
  chrome.contextMenus.create({
    id: "save-to-transit",
    title: "发送到资源",
    contexts: ["image", "video", "audio", "selection"]
  }, () => {
    if (chrome.runtime.lastError) { /* ignore already exists error */ }
  });
};

// 安装或更新时重新创建
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    initContextMenu();
  });
});

// 浏览器启动时确保存在
chrome.runtime.onStartup.addListener(() => {
  initContextMenu();
});

// 开发模式下（加载已解压的扩展程序）经常会漏掉 onInstalled，
// 所以在 service worker 顶层也尝试注册一次，确保随时可用。
initContextMenu();

// 监听扩展更新，强制立即生效，避免一直提示“正在更新”
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log("Update available: ", details.version);
  chrome.runtime.reload();
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-transit") {
    let resourceUrl = info.srcUrl;
    let type = info.mediaType || 'image'; // 'image', 'video', 'audio'
    
    // Check if it is text selection
    if (info.selectionText) {
      type = 'text';
      resourceUrl = info.selectionText;
    }
    
    // 保存到 storage
    // 因为 transitResources 在 App.tsx 中已经迁移到 localforage (IndexedDB)，
    // 这里如果继续用 chrome.storage.local 存储大 Base64 可能会导致 OOM 或超限闪退 (QUOTA_BYTES_PER_ITEM).
    // 由于 service worker 无法直接使用 localforage，我们限制只在这里存最新的一条或只发送消息。
    // 为了不撑爆 storage，我们控制 storage.local.transitResources 最多只保留最新 5 条。
    chrome.storage.local.get(['transitResources'], async (result) => {
      let resources = result.transitResources || [];
      if (!Array.isArray(resources)) resources = [];
      console.log('>>>>>>>>>>>>>>>>>>>>>>chrome.storage.local');

      // 尝试调用本地引擎接口保存文件到 migrated 目录
      let finalUrl = resourceUrl;
      let finalSource = 'extension';
      
      try {
        // 如果资源是 URL 或者 data URL，尝试直接下载并发送到本地引擎
        if (resourceUrl.startsWith('http') || resourceUrl.startsWith('data:') || resourceUrl.startsWith('blob:')) {
          const res = await fetch(resourceUrl);
          const blob = await res.blob();
          const ext = type === 'image' ? 'png' : type === 'video' ? 'mp4' : 'mp3';
          const filename = `extension_capture_${Date.now()}.${ext}`;
          
          const formData = new FormData();
          formData.append('file', blob, filename);
          formData.append('subfolder', 'migrated');

          const uploadRes = await fetch('http://127.0.0.1:18080/api/files/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            finalUrl = data.url;
            finalSource = 'local-tool';
          }
        }
      } catch (e) {
        console.log('Local engine upload failed or unavailable, fallback to base64/url', e);
      }
      
      const newResource = {
        id: Date.now().toString(),
        url: finalUrl,
        type: type,
        timestamp: Date.now(),
        pageUrl: info.pageUrl,
        pageTitle: tab ? tab.title : '未知页面',
        source: finalSource
      };
      
      // Keep only the latest 5 to avoid storage bloat/crash in extension background
      resources = [newResource, ...resources].slice(0, 5);
      
      chrome.storage.local.set({ transitResources: resources }, () => {
        // 通知侧边栏更新 (App.tsx 会接管并存入不限容量的 localforage)
        // 使用 callback 并读取 chrome.runtime.lastError，避免侧边栏未打开或接收端未响应时在控制台产生
        // "Unchecked runtime.lastError: The message port closed before a response was received."
        chrome.runtime.sendMessage({ action: "resourceAdded", resource: newResource }, () => {
          if (chrome.runtime.lastError) {
            // Ignore error if side panel is not open to receive message
            void chrome.runtime.lastError.message;
          }
        });
        
        // 尝试打开侧边栏 (如果未打开)
        if (tab && tab.windowId && chrome.sidePanel && chrome.sidePanel.open) {
             chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
        }
      });
    });
  }
});

// ──────────────────────────────────────────────
//  调试模式 — 请求日志 + 端点探针
// ──────────────────────────────────────────────

const DEBUG_KEY = 'debugMode';

const sendDebug = (payload) => {
  chrome.runtime.sendMessage({ action: 'debug.event', payload }, () => {
    void chrome.runtime.lastError; // ignore if side panel not open
  });
};

// ── 端点探针清单（对应 断点三域梳理.md） ──
const PROBE_ENDPOINTS = [
  // B 域 — localTool（预期 200 / stub 可区分）
  { key:'status',           method:'GET',  url:'http://127.0.0.1:18080/api/status' },
  { key:'sync-default',     method:'GET',  url:'http://127.0.0.1:18080/api/sync/default' },
  { key:'files-upload',     method:'POST', url:'http://127.0.0.1:18080/api/files/upload', body:null },
  { key:'tasks-list',       method:'GET',  url:'http://127.0.0.1:18080/api/tasks' },
  { key:'kv-get',           method:'GET',  url:'http://127.0.0.1:18080/api/kv/get?key=__debug_probe' },
  { key:'kv-set',           method:'POST', url:'http://127.0.0.1:18080/api/kv/set', body:{key:'__debug_probe',value:'1'} },
  { key:'kv-delete',        method:'POST', url:'http://127.0.0.1:18080/api/kv/delete', body:{key:'__debug_probe'} },
  { key:'upload-app-asset', method:'POST', url:'http://127.0.0.1:18080/api/upload/app-asset', body:null },
  { key:'workflow-by-proj', method:'GET',  url:'http://127.0.0.1:18080/api/workflow-apps/by-project/__probe' },
  { key:'jianying-send',    method:'POST', url:'http://127.0.0.1:18080/api/jianying/send', body:{} },
  { key:'plugin-manifest',  method:'GET',  url:'http://127.0.0.1:18080/plugin/manifest.json' },
  // C 域 — 网关（实际运行端口 9004，main.py 默认 8000 未生效；全部走 localTool 精确路由 POST /api/proxy + body.url，见 system.ts:33-36/108-117）
  { key:'gw-status',        method:'POST', url:'http://127.0.0.1:18080/api/proxy', body:{url:'http://127.0.0.1:9004/health', method:'GET'}, timeout:5000 },
  { key:'gw-images-draw',   method:'POST', url:'http://127.0.0.1:18080/api/proxy', body:{url:'http://127.0.0.1:9004/v1/images/generations', method:'POST', prompt:'__probe'}, timeout:10000 },
  { key:'gw-videos-submit', method:'POST', url:'http://127.0.0.1:18080/api/proxy', body:{url:'http://127.0.0.1:9004/v1/videos', method:'POST'}, timeout:10000 },
  { key:'gw-videos-poll',   method:'POST', url:'http://127.0.0.1:18080/api/proxy', body:{url:'http://127.0.0.1:9004/v1/tasks/__probe', method:'GET'}, timeout:10000 },
  { key:'gw-chat',          method:'POST', url:'http://127.0.0.1:18080/api/proxy', body:{url:'http://127.0.0.1:9004/v1/chat/completions', method:'POST', messages:[{role:'user',content:'hi'}]}, timeout:15000 },
];

async function runProbe(respond) {
  const results = [];
  for (const ep of PROBE_ENDPOINTS) {
    const start = Date.now();
    let status, body, error;
    try {
      const init = { method: ep.method, signal: AbortSignal.timeout(ep.timeout || 5000) };
      if (ep.headers) init.headers = ep.headers;
      if (ep.body !== undefined) {
        init.headers = { ...init.headers, 'Content-Type': 'application/json' };
        init.body = ep.body === null ? undefined : JSON.stringify(ep.body);
      }
      const res = await fetch(ep.url, init);
      status = res.status;
      try { body = await res.json(); } catch { body = await res.text().catch(() => ''); }
    } catch (e) {
      status = e.name === 'TimeoutError' || e.name === 'AbortError' ? 'TIMEOUT' : 'NET_ERR';
      error = e.message;
    }
    const elapsed = Date.now() - start;
    // 判定：_meta.stub → stub；200/299 → ok；404(已知缺口)或4xx/5xx → warn/fail
    let verdict = 'ok';
    if (status === 'TIMEOUT' || status === 'NET_ERR') {
      verdict = 'fail';
    } else if (status >= 500) {
      verdict = 'fail';
    } else if (status >= 400) {
      // 404 已知缺口视作 warn，其他 4xx 视作 fail
      const knownMissing = ['sync-default', 'kv-delete', 'upload-app-asset'];
      if (knownMissing.includes(ep.key)) {
        verdict = 'warn';
      } else if (ep.key.startsWith('gw-')) {
        // 网关端点：404 = 路由真缺(fail)；其他 4xx(如 422 缺字段) = 网关可达且路由存在 → ok
        verdict = (status === 404) ? 'fail' : 'ok';
      } else if ((ep.key === 'files-upload' || ep.key === 'jianying-send') && body && typeof body === 'object' && /Missing fileUrl/.test(JSON.stringify(body))) {
        // 端点存活，只是探针未带有效请求体（校验 400）≠ 断点
        verdict = 'ok';
      } else {
        verdict = 'fail';
      }
    } else if (body && typeof body === 'object' && body._meta && body._meta.stub) {
      verdict = 'stub';
    }

    results.push({ key: ep.key, url: ep.url, method: ep.method, status, elapsed, verdict, error: error || null, bodySnippet: typeof body === 'string' ? body.slice(0,120) : JSON.stringify(body).slice(0,120) });
    // 推一条实时进度给侧边栏
    sendDebug({ type:'probe.progress', entry: results[results.length-1], done: results.length, total: PROBE_ENDPOINTS.length });
  }
  // 汇总
  const okCount = results.filter(r=>r.verdict==='ok').length;
  const stubCount = results.filter(r=>r.verdict==='stub').length;
  const warnCount = results.filter(r=>r.verdict==='warn').length;
  const failCount = results.filter(r=>r.verdict==='fail').length;
  sendDebug({ type:'probe.done', results, summary: { total:results.length, ok:okCount, stub:stubCount, warn:warnCount, fail:failCount } });
  if (respond) respond({ ok: true, results, summary: { total:results.length, ok:okCount, stub:stubCount, warn:warnCount, fail:failCount } });
}

// ── 消息路由：调试命令 ──
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (!msg || !msg.action) return false;

  if (msg.action === 'debug.toggle') {
    chrome.storage.local.get([DEBUG_KEY], (r) => {
      const next = !r[DEBUG_KEY];
      chrome.storage.local.set({ [DEBUG_KEY]: next });
      respond({ debugMode: next });
    });
    return true; // async response
  }

  if (msg.action === 'debug.getState') {
    chrome.storage.local.get([DEBUG_KEY], (r) => {
      respond({ debugMode: !!r[DEBUG_KEY] });
    });
    return true;
  }

  if (msg.action === 'debug.runProbe') {
    runProbe(respond);
    return true;
  }
});
