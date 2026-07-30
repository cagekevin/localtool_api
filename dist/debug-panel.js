/* ════════════════════════════════════════════════
   一毛调试模式 — 请求拦截 + 端点探针
   左下角常驻「🔍 调试」按钮点击开关（或 Ctrl+Shift+D） | 浮层面板
   （独立文件，规避 MV3 内联脚本 CSP 限制）
   ════════════════════════════════════════════════ */
(function(){
  var STORAGE_KEY = 'debugMode';
  var MAX_LOGS = 300;
  var debugOn = false;
  var logs = [];
  var activeTab = 'log'; // 'log' | 'probe'
  var panel = null, logEl = null, probeEl = null, tabBtns = [];

  // ── 初始化：从 storage 读状态 ──
  try { chrome.storage.local.get([STORAGE_KEY], function(r){ if(r[STORAGE_KEY]) enable(); }); } catch(e){}

  // ── 快捷键 Ctrl+Shift+D（同时提供常驻 🔍 按钮，避免焦点/浏览器快捷键吞掉）──
  document.addEventListener('keydown', function(e){
    var k = e.key || '';
    if (e.ctrlKey && e.shiftKey && (k === 'D' || k === 'd' || e.code === 'KeyD')) { e.preventDefault(); toggle(); }
  });

  // 常驻悬浮按钮：始终可见，点击开关面板（不需要侧边栏获得焦点，也不被浏览器快捷键拦截）
  var fab = document.createElement('div');
  fab.id = 'ym-debug-fab';
  fab.textContent = '🔍 调试';
  fab.title = '点击开关调试面板（或按 Ctrl+Shift+D）';
  fab.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#2a2a2a;color:#ccc;border:1px solid #555;border-radius:4px;padding:4px 9px;font:11px monospace;cursor:pointer;user-select:none;box-shadow:0 1px 4px rgba(0,0,0,.5)';
  fab.onclick = toggle;
  try { (document.body || document.documentElement).appendChild(fab); } catch(e){}

  // ── 切换 ──
  function toggle(){
    var next = !debugOn;
    try { chrome.storage.local.set({[STORAGE_KEY]:next}); } catch(e){}
    next ? enable() : disable();
  }
  function enable(){ debugOn=true; ensurePanel(); updatePanelVisibility(); }
  function disable(){ debugOn=false; updatePanelVisibility(); }

  // ── 面板 UI ──
  function ensurePanel(){
    if (panel) return;
    // 注入样式
    var s = document.createElement('style');
    s.textContent = [
      '#ym-debug-panel{position:fixed;bottom:0;left:0;right:0;z-index:2147483646;background:rgba(18,18,22,.94);color:#e0e0e0;font:11px/1.5 monospace;border-top:2px solid #555;max-height:40vh;display:flex;flex-direction:column;pointer-events:all;transition:transform .2s}',
      '#ym-debug-panel.ym-hidden{transform:translateY(100%)}',
      '#ym-debug-bar{display:flex;align-items:center;padding:2px 8px;background:#222;gap:6px;user-select:none;flex-shrink:0}',
      '#ym-debug-bar .ym-btn{padding:2px 10px;border:1px solid #444;border-radius:3px;cursor:pointer;color:#aaa;background:#2a2a2a;font:11px monospace}',
      '#ym-debug-bar .ym-btn:hover{background:#3a3a3a;color:#fff}',
      '#ym-debug-bar .ym-btn.active{background:#3a6;border-color:#3a6;color:#fff}',
      '#ym-debug-bar .ym-btn.ym-danger{background:#a33;border-color:#a33;color:#fff}',
      '#ym-debug-bar .ym-badge{padding:0 5px;border-radius:8px;font-size:10px;background:#333;color:#999}',
      '#ym-debug-bar .ym-badge.ok{background:#153;color:#5c5}',
      '#ym-debug-bar .ym-badge.warn{background:#330;color:#ea5}',
      '#ym-debug-bar .ym-badge.fail{background:#300;color:#f55}',
      '#ym-debug-bar .ym-badge.stub{background:#223;color:#88c}',
      '#ym-debug-bar .ym-title{color:#888;font-size:10px;margin-right:8px}',
      '#ym-debug-body{flex:1;overflow-y:auto;padding:4px 8px;font-size:10px;min-height:0}',
      '#ym-debug-body .ym-log{display:flex;gap:6px;padding:1px 0;border-bottom:1px solid rgba(255,255,255,.04)}',
      '#ym-debug-body .ym-log .ym-ts{color:#666;flex-shrink:0;min-width:66px}',
      '#ym-debug-body .ym-log .ym-method{color:#88c;flex-shrink:0;min-width:36px;text-align:right}',
      '#ym-debug-body .ym-log .ym-url{color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#ym-debug-body .ym-log .ym-status{flex-shrink:0;min-width:36px;text-align:right;font-weight:bold}',
      '#ym-debug-body .ym-log .ym-status.ok{color:#5c5}',
      '#ym-debug-body .ym-log .ym-status.warn{color:#ea5}',
      '#ym-debug-body .ym-log .ym-status.fail{color:#f55}',
      '#ym-debug-body .ym-log .ym-ms{color:#555;flex-shrink:0;min-width:40px;text-align:right}',
      '#ym-debug-body .ym-endpoint{display:flex;gap:6px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04);align-items:center}',
      '#ym-debug-body .ym-endpoint .ym-ekey{color:#aaa;min-width:140px;flex-shrink:0}',
      '#ym-debug-body .ym-endpoint .ym-everdict{padding:0 4px;border-radius:2px;font-size:10px;min-width:32px;text-align:center}',
    ].join('\n');
    document.head.appendChild(s);

    panel = document.createElement('div'); panel.id = 'ym-debug-panel'; panel.className = 'ym-hidden';
    panel.innerHTML = [
      '<div id="ym-debug-bar">',
        '<span class="ym-title">🔍 调试</span>',
        '<button class="ym-btn active" data-tab="log">请求日志</button>',
        '<button class="ym-btn" data-tab="probe">端点探针</button>',
        '<span style="flex:1"></span>',
        '<span id="ym-count" class="ym-badge" style="display:none">0</span>',
        '<button id="ym-probe-btn" class="ym-btn">▶ 探针</button>',
        '<button id="ym-clear-btn" class="ym-btn">清空</button>',
        '<button id="ym-close-btn" class="ym-btn ym-danger">✕</button>',
      '</div>',
      '<div id="ym-debug-body"></div>',
    ].join('');
    document.body.appendChild(panel);

    logEl = document.createElement('div'); logEl.style.cssText = 'min-height:0;overflow-y:auto';
    probeEl = document.createElement('div'); probeEl.style.cssText = 'min-height:0;overflow-y:auto;display:none';
    var body = panel.querySelector('#ym-debug-body');
    body.appendChild(logEl);
    body.appendChild(probeEl);

    // 事件
    panel.querySelector('#ym-close-btn').onclick = disable;
    panel.querySelector('#ym-clear-btn').onclick = function(){ logs=[]; renderLogs(); updateCount(); };
    panel.querySelector('#ym-probe-btn').onclick = function(){ runProbe(); };
    tabBtns = panel.querySelectorAll('[data-tab]');
    tabBtns.forEach(function(b){ b.onclick = function(){ switchTab(b.dataset.tab); }; });
  }

  function updatePanelVisibility(){
    if (panel) panel.classList.toggle('ym-hidden', !debugOn);
    if (fab) fab.style.display = debugOn ? 'none' : ''; // 面板打开时隐藏按钮，避免遮挡
  }
  function switchTab(t){
    activeTab = t;
    tabBtns.forEach(function(b){ b.classList.toggle('active', b.dataset.tab === t); });
    logEl.style.display = t==='log'?'':'none';
    probeEl.style.display = t==='probe'?'':'none';
  }
  function updateCount(){
    var el = document.getElementById('ym-count');
    if (!el) return;
    var failCount = logs.filter(function(l){ return l.verdict === 'fail' || l.status >= 400; }).length;
    if (failCount || logs.length){
      el.style.display = '';
      el.textContent = logs.length + (failCount?' ('+failCount+')':'');
      el.className = 'ym-badge '+(failCount?'fail':'ok');
    } else el.style.display = 'none';
  }

  // ── 请求拦截（fetch + XHR） ──
  var _fetch = window.fetch;
  window.fetch = function(input, init){
    var start = Date.now();
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    var method = (init && init.method) || 'GET';
    // 仅记录发往 localTool / 网关 / 官方的请求
    var shouldLog = url && /(localhost|127\.0\.0\.1|18080|1mao|kkidc|lovart|0\.1mao)/i.test(url);
    return _fetch.call(this, input, init).then(function(res){
      if (shouldLog) addLog(method, url, res.status, Date.now()-start, null);
      return res;
    }).catch(function(e){
      if (shouldLog) addLog(method, url, 'ERR', Date.now()-start, e.message);
      throw e;
    });
  };
  // XHR 拦截
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url){
    this.__ym_method = method; this.__ym_url = url; this.__ym_start = 0;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(){
    var self = this;
    this.__ym_start = Date.now();
    this.addEventListener('loadend', function(){
      var url = self.__ym_url;
      if (url && /(localhost|127\.0\.0\.1|18080|1mao|kkidc|lovart|0\.1mao)/i.test(url)){
        addLog(self.__ym_method, url, self.status, Date.now()-self.__ym_start, null);
      }
    });
    this.addEventListener('error', function(){
      var url = self.__ym_url;
      if (url && /(localhost|127\.0\.0\.1|18080|1mao|kkidc|lovart|0\.1mao)/i.test(url)){
        addLog(self.__ym_method, url, 'ERR', Date.now()-self.__ym_start, 'XHR error');
      }
    });
    return _send.apply(this, arguments);
  };

  function addLog(method, url, status, elapsed, error){
    var entry = {
      ts: new Date().toISOString().slice(11,19),
      method: method,
      url: sanitizeUrl(url),
      status: status,
      elapsed: elapsed || 0,
      error: error || null,
      verdict: (status >= 400 || typeof status === 'string') ? 'fail' : 'ok'
    };
    logs.unshift(entry);
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    if (debugOn) renderLogs();
    updateCount();
  }

  function sanitizeUrl(u){
    // 截短 80 字符
    return (u||'').length > 80 ? u.slice(0,77)+'...' : u;
  }

  function renderLogs(){
    if (!logEl) return;
    logEl.innerHTML = logs.map(function(l){
      var sc = l.verdict;
      return '<div class="ym-log"><span class="ym-ts">'+esc(l.ts)+'</span><span class="ym-method">'+esc(l.method)+'</span><span class="ym-url" title="'+esc(l.url)+'">'+esc(l.url)+'</span><span class="ym-status '+sc+'">'+esc(String(l.status))+'</span><span class="ym-ms">'+l.elapsed+'ms</span></div>';
    }).join('');
  }

  // ── 端点探针 ──
  function runProbe(){
    if (!probeEl) return;
    probeEl.innerHTML = '<div style="color:#888;padding:8px">探测中...</div>';
    switchTab('probe');
    try { chrome.runtime.sendMessage({action:'debug.runProbe'}); } catch(e){}
  }

  // ── 接收 background.js 的调试消息 ──
  try {
    chrome.runtime.onMessage.addListener(function(msg){
      if (!msg || msg.action !== 'debug.event' || !msg.payload) return;
      var p = msg.payload;
      if (p.type === 'probe.progress'){
        renderProbeProgress(p);
      } else if (p.type === 'probe.done'){
        renderProbeDone(p);
      }
    });
  } catch(e){}

  function renderProbeProgress(p){
    if (!probeEl) return;
    var e = p.entry;
    var vc = e.verdict === 'ok' ? '#5c5' : e.verdict === 'stub' ? '#88c' : e.verdict === 'warn' ? '#ea5' : '#f55';
    probeEl.innerHTML = '<div style="color:#888;padding:4px 8px">探测中 '+p.done+'/'+p.total+'...</div>' +
      probeEl.innerHTML +
      '<div class="ym-endpoint"><span class="ym-everdict" style="background:'+vc+'33;color:'+vc+'">'+e.verdict.toUpperCase()+'</span><span class="ym-ekey">'+esc(e.key)+'</span><span style="color:#888;min-width:40px">'+e.status+'</span><span style="color:#555">'+e.elapsed+'ms</span><span style="color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(e.bodySnippet||'')+'">'+esc(e.bodySnippet||'')+'</span></div>';
  }

  function renderProbeDone(p){
    if (!probeEl) return;
    var s = p.summary;
    probeEl.innerHTML = [
      '<div style="padding:4px 8px;border-bottom:1px solid #333">',
        '<b>探针完成</b> 共 '+s.total+' 端点：',
        '<span style="color:#5c5">✅ '+s.ok+'</span> ',
        s.stub ? '<span style="color:#88c">📌 '+s.stub+'</span> ' : '',
        '<span style="color:#ea5">⚠️ '+s.warn+'</span> ',
        '<span style="color:#f55">❌ '+s.fail+'</span>',
      '</div>',
      p.results.map(function(e){
        var vc = e.verdict === 'ok' ? '#5c5' : e.verdict === 'stub' ? '#88c' : e.verdict === 'warn' ? '#ea5' : '#f55';
        var emoji = e.verdict === 'ok' ? '✅' : e.verdict === 'stub' ? '📌' : e.verdict === 'warn' ? '⚠️' : '❌';
        return '<div class="ym-endpoint"><span class="ym-everdict" style="background:'+vc+'33;color:'+vc+'">'+e.verdict.toUpperCase()+'</span><span class="ym-ekey" title="'+esc(e.url)+'">'+esc(e.key)+'</span><span style="color:#888;min-width:40px">'+e.status+'</span><span style="color:#555">'+e.elapsed+'ms</span><span style="color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(e.bodySnippet||'')+'">'+esc(e.bodySnippet||'')+'</span></div>';
      }).join('')
    ].join('');
  }

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // 暴露外部接口
  window.__ymDebug = { toggle: toggle, enable: enable, disable: disable, logs: logs, runProbe: runProbe };
})();
