/**
 * [auto chunk header]
 * 角色：分享页主程序（只读预览渲染）
 * 主要导出：default 导出（分享页主组件）
 * 对接模块：引用 vendor / httpClient（只读拉取）
 * 改动注意：只读渲染分享内容，勿引入写操作或本地引擎调用。
 */
import { i as e } from './rolldown-runtime-aKtaBQYM.js';
import { At as t, Fr as n, Ln as r, Lt as i, Mr as a, Nn as o, Qt as s, Rr as c, in as ee, pt as te, sr as l, wt as u, zt as ne } from './vendor-Z-adA07W.js';
import { J as d, X as f, a as re, c as ie, ct as p, d as ae, ft as oe, j as se, l as m, n as h, u as ce } from './httpClient-BknZwXjG.js';
var g = e(c(), 1);
var _ = n();
var v = {
  builtin: "default",
  discountVideo: "tehuishipin",
  aiApp: "yimaoAiApp"
};
function le(e2) {
  return (Array.isArray(e2) ? e2 : Object.values(e2 || {})).reduce((e3, t2) => (t2?.id && (e3[t2.id] = t2.url || ""), e3), {});
}
var y = /* @__PURE__ */new Set(["image", "video", "audio"]);
var b = () => {};
var x = [];
var ue = [];
var de = {
  type: "FREE",
  expiry: 0
};
function fe(e2) {
  return e2 && typeof e2 == "object" ? {
    ...e2,
    nodes: Array.isArray(e2.nodes) ? e2.nodes.map(e3 => {
      let t2 = {
        ...(e3?.data || {})
      };
      return ("loading" in t2 || "progress" in t2 || "status" in t2 || "taskId" in t2 || "requestData" in t2 || "responseData" in t2 || "errorMsg" in t2 || "errorMessage" in t2 || "resultData" in t2 || "customResultData" in t2) && (delete t2.loading, delete t2.progress, delete t2.status, delete t2.taskId, delete t2.requestData, delete t2.responseData, delete t2.errorMsg, delete t2.errorMessage, delete t2.resultData, delete t2.customResultData, delete t2.text, delete t2.videoUrl, delete t2.audioUrl, delete t2.thumbnailUrl, delete t2.imageAvailable, delete t2.imageUrlRef, delete t2.imageUrlThumbRef, delete t2.imageUrlUploaded, delete t2.extractedImages, delete t2.allExtractedImages, delete t2.hasChanged, delete t2.running), {
        ...e3,
        data: t2
      };
    }) : [],
    edges: Array.isArray(e2.edges) ? e2.edges : []
  } : {
    nodes: [],
    edges: []
  };
}
function pe(e2) {
  let t2 = String(e2 || "").trim();
  if (!t2) {
    return "运行失败，请稍后重试。";
  }
  let n2 = t2.toLowerCase();
  return n2.includes("invalid token") ? "应用运行失败：应用凭证无效，请联系应用作者检查后端接入配置。" : n2.includes("unauthorized") || n2.includes("401") ? "应用运行失败：当前请求未通过鉴权，请联系应用作者检查授权配置。" : n2.includes("failed to fetch") || n2.includes("network") ? "应用运行失败：网络连接异常，请稍后重试。" : t2;
}
function me(e2, t2) {
  let n2 = `${p.replace(/[\s`]/g, "").replace(/\/$/, "")}/api/workflow-apps/${encodeURIComponent(e2)}`;
  return t2 ? `${n2}?licenseToken=${encodeURIComponent(t2)}` : n2;
}
function S({
  app: e2,
  onBack: n2,
  canvasProps: c2,
  licenseToken: l2
}) {
  let u2 = (0, g.useMemo)(() => `workflow-app-license-${e2.appId}`, [e2.appId]);
  let [y2, S2] = (0, g.useState)(true);
  let [C2, w2] = (0, g.useState)("");
  let [T, E] = (0, g.useState)(false);
  let [_e, ve] = (0, g.useState)(e2.appName || "应用");
  let [D, ye] = (0, g.useState)("");
  let [be, xe] = (0, g.useState)("private");
  let [Se, Ce] = (0, g.useState)(1);
  let [O, k] = (0, g.useState)([]);
  let [A, j] = (0, g.useState)([]);
  let [M, N] = (0, g.useState)({});
  let [we, P] = (0, g.useState)("");
  let [F, I] = (0, g.useState)(false);
  let [L, R] = (0, g.useState)(false);
  let [z, B] = (0, g.useState)([]);
  let [V, H] = (0, g.useState)([]);
  let [Te, Ee] = (0, g.useState)(false);
  let [De, U] = (0, g.useState)(false);
  let [W, G] = (0, g.useState)("");
  let [K, q] = (0, g.useState)(() => l2 || localStorage.getItem(u2) || "");
  let [Oe, J] = (0, g.useState)("");
  let [ke, Ae] = (0, g.useState)(false);
  let [je, Me] = (0, g.useState)({});
  let Y = (0, g.useRef)(0);
  let X = (0, g.useMemo)(() => `__apprun_${e2.appId}`, [e2.appId]);
  let Z = (0, g.useMemo)(() => ({
    ...c2,
    ...je,
    showToast: c2.showToast || b,
    transitResources: c2.transitResources || x,
    addTransitResource: c2.addTransitResource || b,
    presetPrompts: c2.presetPrompts || x,
    membership: c2.membership || de,
    globalTasks: c2.globalTasks || x,
    updateGlobalTasks: c2.updateGlobalTasks || b,
    customNodeTemplates: c2.customNodeTemplates || ue,
    onAddCustomNodeTemplate: c2.onAddCustomNodeTemplate || b,
    onDeleteCustomNodeTemplate: c2.onDeleteCustomNodeTemplate || b
  }), [je, c2]);
  let Q = (0, g.useCallback)(async t2 => {
    let n3 = ++Y.current;
    S2(true);
    w2("");
    I(false);
    E(false);
    try {
      let r2 = await h(me(e2.appId, t2), {
        skipAuth: true
      });
      if (n3 !== Y.current) {
        return;
      }
      if (!r2.success) {
        throw Error(r2.error || "加载失败");
      }
      let i2 = r2.data;
      let a2 = i2?.data ?? i2;
      if (!a2) {
        throw Error(i2?.error || r2.error || "加载失败");
      }
      if (ve(a2.appName || e2.appName || "应用"), ye(a2.description || ""), xe(a2.visibility || "private"), Ce(a2.currentVersionNo || 1), !a2.access?.canRun) {
        k([]);
        j([]);
        E(true);
        I(false);
        U(true);
        J(a2.access?.requiresLicense ? "该应用需要许可证后才能运行，请输入许可证 Token。" : "当前账号没有运行权限。");
        return;
      }
      let o2 = a2.inputSchema?.fields || [];
      k(o2);
      j(a2.mappingSchema?.fields || []);
      N(Object.fromEntries(o2.map(e3 => [e3.id, e3.defaultValue ?? ""])));
      await d.setObject(f(X), fe(a2.workflowSnapshot || {
        nodes: [],
        edges: []
      }));
      I(true);
      E(false);
      U(false);
      J("");
      t2 && (localStorage.setItem(u2, t2), G(t2), q(t2));
      let s2 = await h(`${p}/api/sync/default`, {
        skipAuth: true
      });
      if (s2.success && s2.data) {
        let e3 = le((s2.data.data || s2.data)?.apiConfigs);
        let t3 = oe(p);
        let n4 = e4 => e4.replace("{VITE_API_BASE_URL}", t3);
        Me({
          builtinApiUrl: n4(e3[v.builtin] || ""),
          textApiUrl: n4(e3[v.builtin] || ""),
          imageApiUrl: n4(e3[v.builtin] || ""),
          videoApiUrl: n4(e3[v.builtin] || ""),
          discountVideoApiUrl: n4(e3[v.discountVideo] || ""),
          audioApiUrl: n4(e3[v.builtin] || ""),
          aiAppApiUrl: n4(e3[v.aiApp] || "")
        });
      }
      await se(p, true).catch(() => void 0);
    } catch (e3) {
      if (n3 !== Y.current) {
        return;
      }
      w2(e3?.message || "加载失败");
      J("");
    } finally {
      n3 === Y.current && S2(false);
    }
  }, [e2.appId, e2.appName, X, u2]);
  (0, g.useEffect)(() => ((async () => {
    await Q(K || void 0);
  })(), () => {
    d.remove(f(X)).catch(() => {});
  }), [Q, K, X]);
  (0, g.useEffect)(() => {
    let e3 = e4 => {
      let t2 = e4.detail || {};
      if (console.log("[WorkflowAppRunner] 收到工作流完成事件:", t2), t2.targetProjectId && t2.targetProjectId !== X) {
        return;
      }
      let n3 = Array.isArray(t2.results) ? t2.results : [];
      let r2 = Array.isArray(t2.errors) ? t2.errors : [];
      B(n3);
      H(r2);
      R(false);
      Ee(true);
    };
    return window.addEventListener(m, e3), () => window.removeEventListener(m, e3);
  }, [X]);
  let Ne = (0, g.useCallback)(async () => {
    let t2 = W.trim() || K;
    if (!t2) {
      J("请输入许可证 Token");
      return;
    }
    Ae(true);
    J("");
    try {
      let n3 = await re(`/workflow-apps/${encodeURIComponent(e2.appId)}/verify-license`, {
        licenseToken: t2
      });
      if (!n3.success) {
        throw Error(n3.error || "许可证验证失败");
      }
      localStorage.setItem(u2, t2);
      q(t2);
      G("");
      U(false);
      await Q(t2);
      J("许可证验证成功");
    } catch (e3) {
      J(e3?.message || "许可证验证失败");
      U(true);
    } finally {
      Ae(false);
    }
  }, [e2.appId, W, K, Q, u2]);
  let Pe = (0, g.useCallback)(() => {
    let e3 = O.filter(e4 => e4.required && (M[e4.id] === void 0 || M[e4.id] === ""));
    if (e3.length > 0) {
      w2(`\u8BF7\u5148\u586B\u5199\uFF1A${e3.map(e4 => e4.label || e4.key).join("、")}`);
      return;
    }
    w2("");
    let t2 = A.map(e4 => ({
      nodeId: e4.nodeId,
      path: e4.path,
      value: M[e4.id]
    })).filter(e4 => e4.nodeId && e4.value !== void 0 && e4.value !== "");
    B([]);
    H([]);
    R(true);
    window.dispatchEvent(new CustomEvent(ie, {
      detail: {
        targetProjectId: X
      }
    }));
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(ce, {
        detail: {
          targetProjectId: X,
          injections: t2
        }
      }));
    }, 80);
  }, [A, M, X, O]);
  let $ = (e3, t2) => N(n3 => ({
    ...n3,
    [e3]: t2
  }));
  let Fe = (0, g.useCallback)(async (e3, t2) => {
    P(e3.id);
    try {
      let n3 = new FormData();
      n3.append("file", t2);
      let r2 = {};
      let i2 = p.replace(/[\s`]/g, "").replace(/\/$/, "");
      let a2 = await fetch(`${i2}/api/upload/app-asset`, {
        method: "POST",
        headers: r2,
        body: n3
      });
      let o2 = await a2.json().catch(() => ({}));
      if (!a2.ok || o2.success === false) {
        throw Error(o2.error || "上传失败");
      }
      let s2 = (o2.data || o2).url;
      $(e3.id, s2);
    } catch (e4) {
      w2(e4?.message || "上传失败");
    } finally {
      P("");
    }
  }, [e2.appId]);
  let Ie = F && !L && !y2;
  return (0, _.jsxs)("div", {
    className: "h-full w-full overflow-y-auto bg-[#0b0a0a] text-gray-100 custom-scrollbar",
    children: [(0, _.jsx)("div", {
      'aria-hidden': true,
      className: "fixed pointer-events-none opacity-0",
      style: {
        width: 1280,
        height: 720,
        left: -99999,
        top: 0,
        zIndex: -1,
        overflow: "hidden"
      },
      children: F ? (0, _.jsx)(ae, {
        ...Z,
        licenseToken: K || Z?.licenseToken,
        projectId: X
      }) : null
    }), (0, _.jsxs)("div", {
      className: "mx-auto w-full max-w-5xl px-5 py-6 md:px-8 md:py-10",
      children: [(0, _.jsxs)("div", {
        className: "flex items-start justify-between gap-4 flex-wrap",
        children: [(0, _.jsxs)("div", {
          className: "min-w-0 flex items-start gap-3",
          children: [n2 ? (0, _.jsx)("button", {
            onClick: n2,
            className: "mt-1 text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors",
            children: (0, _.jsx)(a, {
              size: 18
            })
          }) : null, (0, _.jsxs)("div", {
            className: "min-w-0",
            children: [(0, _.jsx)("div", {
              className: "flex items-center gap-2 flex-wrap",
              children: (0, _.jsx)("h1", {
                className: "text-2xl md:text-3xl font-extrabold leading-tight truncate",
                children: _e
              })
            }), (0, _.jsxs)("div", {
              className: "mt-2 flex items-center gap-2 flex-wrap",
              children: [(0, _.jsx)("span", {
                className: "inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-gray-300",
                children: be === "public" ? "公开应用" : "私有应用"
              }), (0, _.jsxs)("span", {
                className: "inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-gray-300",
                children: ["版本 V", Se]
              }), T ? (0, _.jsx)("span", {
                className: "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] text-amber-300",
                children: "需要许可证"
              }) : F ? (0, _.jsx)("span", {
                className: "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-300",
                children: "可运行"
              }) : null]
            }), D ? (0, _.jsx)("p", {
              className: "mt-3 max-w-2xl text-sm leading-7 text-gray-400",
              children: D
            }) : null]
          })]
        }), (0, _.jsxs)("button", {
          onClick: () => U(true),
          className: "inline-flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#151414] px-3.5 py-2 text-sm text-gray-300 hover:bg-[#1f1f1f] transition-colors",
          children: [(0, _.jsx)(t, {
            size: 15
          }), " 许可证"]
        })]
      }), C2 ? (0, _.jsx)("div", {
        className: "mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300",
        children: C2
      }) : null, (0, _.jsxs)("div", {
        className: "mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2 items-start",
        children: [(0, _.jsxs)("section", {
          className: "rounded-2xl border border-[#242424] bg-[#141313] p-5",
          children: [(0, _.jsxs)("div", {
            className: "flex items-center gap-2",
            children: [(0, _.jsx)(i, {
              size: 16,
              className: "text-blue-400"
            }), (0, _.jsx)("h2", {
              className: "font-bold",
              children: "运行输入"
            })]
          }), (0, _.jsx)("p", {
            className: "mt-1 text-xs text-gray-500",
            children: "填写下面的参数后点击运行"
          }), (0, _.jsx)("div", {
            className: "mt-5 space-y-4",
            children: y2 ? (0, _.jsxs)("div", {
              className: "flex h-40 items-center justify-center text-sm text-gray-500",
              children: [(0, _.jsx)(s, {
                size: 15,
                className: "mr-2 animate-spin"
              }), " 加载中…"]
            }) : T ? (0, _.jsxs)("div", {
              className: "flex flex-col items-center justify-center gap-3 py-10 text-center",
              children: [(0, _.jsx)(ne, {
                size: 28,
                className: "text-amber-400"
              }), (0, _.jsx)("p", {
                className: "text-sm text-gray-400",
                children: "该应用需要许可证后才能运行"
              }), (0, _.jsxs)("button", {
                onClick: () => U(true),
                className: "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500",
                children: [(0, _.jsx)(o, {
                  size: 15
                }), " 输入许可证"]
              })]
            }) : O.length === 0 ? (0, _.jsx)("div", {
              className: "rounded-xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center text-sm text-gray-500",
              children: "该应用无需填写参数，可直接运行。"
            }) : O.map(e3 => (0, _.jsxs)("div", {
              className: "rounded-xl border border-[#232323] bg-[#101010] p-3.5",
              children: [(0, _.jsxs)("label", {
                className: "mb-2 flex items-center gap-2 text-[13px] text-gray-300",
                children: [(0, _.jsx)("span", {
                  className: "font-medium",
                  children: e3.label || e3.key
                }), e3.required ? (0, _.jsx)("span", {
                  className: "text-red-400",
                  children: "*"
                }) : null, (0, _.jsx)("span", {
                  className: "ml-auto text-[10px] uppercase text-gray-600",
                  children: e3.type
                })]
              }), he(e3, M[e3.id], $, we === e3.id, t2 => Fe(e3, t2))]
            }, e3.id))
          }), !T && (0, _.jsxs)("button", {
            onClick: Pe,
            disabled: !Ie,
            className: "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
            children: [L ? (0, _.jsx)(s, {
              size: 16,
              className: "animate-spin"
            }) : (0, _.jsx)(ee, {
              size: 16
            }), L ? "运行中…" : "运行应用"]
          })]
        }), (0, _.jsxs)("section", {
          className: "rounded-2xl border border-[#242424] bg-[#141313] p-5",
          children: [(0, _.jsxs)("div", {
            className: "flex items-center gap-2",
            children: [(0, _.jsx)(r, {
              size: 16,
              className: "text-emerald-400"
            }), (0, _.jsx)("h2", {
              className: "font-bold",
              children: "运行结果"
            })]
          }), (0, _.jsx)("p", {
            className: "mt-1 text-xs text-gray-500",
            children: "应用执行后的输出会显示在这里"
          }), (0, _.jsx)("div", {
            className: "mt-5",
            children: L ? (0, _.jsxs)("div", {
              className: "flex h-48 flex-col items-center justify-center gap-3 text-sm text-gray-500",
              children: [(0, _.jsx)(s, {
                size: 22,
                className: "animate-spin text-blue-400"
              }), "正在运行工作流…"]
            }) : Te ? z.length === 0 && V.length > 0 ? (0, _.jsxs)("div", {
              className: "space-y-3",
              children: [(0, _.jsx)("div", {
                className: "rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200",
                children: "本次运行失败，请检查下面的错误信息。"
              }), V.map((e3, t2) => (0, _.jsxs)("div", {
                className: "rounded-xl border border-red-500/20 bg-[#101010] px-4 py-3",
                children: [(0, _.jsx)("div", {
                  className: "text-sm font-medium text-red-300",
                  children: e3.label || e3.type || e3.nodeId
                }), (0, _.jsx)("div", {
                  className: "mt-1 text-xs leading-6 text-red-200/90 break-words",
                  children: pe(e3.message)
                }), pe(e3.message) === e3.message ? null : (0, _.jsxs)("div", {
                  className: "mt-2 text-[11px] text-gray-500 break-words",
                  children: ["原始错误：", e3.message]
                })]
              }, `${e3.nodeId}-${t2}`))]
            }) : z.length === 0 ? (0, _.jsx)("div", {
              className: "flex h-48 items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] text-sm text-gray-600",
              children: "运行完成，但没有可预览的输出"
            }) : (0, _.jsx)("div", {
              className: "space-y-4",
              children: z.map(e3 => (0, _.jsx)(ge, {
                result: e3
              }, e3.nodeId))
            }) : (0, _.jsx)("div", {
              className: "flex h-48 items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] text-sm text-gray-600",
              children: "尚未运行"
            })
          })]
        })]
      })]
    }), De && (0, _.jsx)("div", {
      className: "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm",
      children: (0, _.jsxs)("div", {
        className: "w-full max-w-md overflow-hidden rounded-2xl border border-[#333] bg-[#111] shadow-2xl",
        children: [(0, _.jsxs)("div", {
          className: "flex items-center justify-between border-b border-[#2a2a2a] bg-[#151414] px-5 py-4",
          children: [(0, _.jsxs)("div", {
            className: "flex items-center gap-2 font-bold text-white",
            children: [(0, _.jsx)(o, {
              size: 18
            }), " 许可证"]
          }), (0, _.jsx)("button", {
            onClick: () => U(false),
            className: "text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5",
            children: (0, _.jsx)(te, {
              size: 16
            })
          })]
        }), (0, _.jsxs)("div", {
          className: "space-y-4 p-5",
          children: [(0, _.jsx)("p", {
            className: "text-xs leading-6 text-gray-500",
            children: "许可证是运行应用的凭证,由应用所属者创建分发"
          }), (0, _.jsx)("input", {
            type: "password",
            value: W,
            onChange: e3 => G(e3.target.value),
            className: "w-full rounded-xl border border-[#333] bg-[#101010] px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500",
            placeholder: K ? "已保存许可证，请输入新的 Token 替换" : "输入许可证 Token",
            autoComplete: "off"
          }), Oe && (0, _.jsx)("div", {
            className: "rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200",
            children: Oe
          }), (0, _.jsxs)("div", {
            className: "flex justify-end gap-2",
            children: [(0, _.jsx)("button", {
              onClick: () => {
                localStorage.removeItem(u2);
                G("");
                q("");
                J("已清除本地许可证缓存");
              },
              className: "rounded-xl border border-[#333] px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white",
              children: "清除"
            }), (0, _.jsxs)("button", {
              onClick: Ne,
              disabled: ke,
              className: "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50",
              children: [ke ? (0, _.jsx)(s, {
                size: 14,
                className: "animate-spin"
              }) : null, "保存并验证"]
            })]
          })]
        })]
      })
    })]
  });
}
function he(e2, t2, n2, r2, i2) {
  if (y.has(e2.type)) {
    let a2 = e2.type === "image" ? "图片" : e2.type === "video" ? "视频" : "音频";
    let o2 = e2.type === "image" ? "image/*" : e2.type === "video" ? "video/*" : "audio/*";
    return (0, _.jsxs)("div", {
      className: "space-y-2",
      children: [(0, _.jsxs)("label", {
        className: "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#3a3a3a] bg-[#0f0f0f] px-3 py-3 text-[13px] text-gray-400 transition-colors hover:border-blue-500 hover:text-gray-200",
        children: [r2 ? (0, _.jsx)(s, {
          size: 14,
          className: "animate-spin"
        }) : (0, _.jsx)(u, {
          size: 14
        }), r2 ? "上传中…" : `\u70B9\u51FB\u4E0A\u4F20${a2}`, (0, _.jsx)("input", {
          type: "file",
          accept: o2,
          className: "hidden",
          onChange: e3 => {
            let t3 = e3.target.files?.[0];
            t3 && i2(t3);
          }
        })]
      }), (0, _.jsx)("input", {
        value: t2 ?? "",
        onChange: t3 => n2(e2.id, t3.target.value),
        className: "w-full rounded-xl border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-blue-500",
        placeholder: "或粘贴资源 URL"
      }), t2 ? (0, _.jsx)("div", {
        className: "overflow-hidden rounded-xl border border-[#262626] bg-black",
        children: e2.type === "image" ? (0, _.jsx)("img", {
          src: t2,
          alt: "preview",
          className: "block max-h-52 w-full object-contain"
        }) : e2.type === "video" ? (0, _.jsx)("video", {
          src: t2,
          controls: true,
          className: "block w-full"
        }) : (0, _.jsx)("audio", {
          src: t2,
          controls: true,
          className: "block w-full p-2"
        })
      }) : null]
    });
  }
  return e2.type === "boolean" ? (0, _.jsxs)("label", {
    className: "inline-flex cursor-pointer items-center gap-2 text-[13px] text-gray-300",
    children: [(0, _.jsx)("input", {
      type: "checkbox",
      checked: !!t2,
      onChange: t3 => n2(e2.id, t3.target.checked),
      className: "h-4 w-4 accent-blue-500"
    }), "启用"]
  }) : e2.type === "json" || e2.type === "text" ? (0, _.jsx)("textarea", {
    value: t2 ?? "",
    onChange: t3 => n2(e2.id, t3.target.value),
    className: "min-h-[88px] w-full resize-y rounded-xl border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm leading-6 text-white outline-none focus:border-blue-500",
    placeholder: `\u8BF7\u8F93\u5165${e2.label || e2.key}`
  }) : (0, _.jsx)("input", {
    type: e2.type === "number" ? "number" : "text",
    value: t2 ?? "",
    onChange: t3 => n2(e2.id, e2.type === "number" ? t3.target.value === "" ? "" : Number(t3.target.value) : t3.target.value),
    className: "w-full rounded-xl border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-blue-500",
    placeholder: `\u8BF7\u8F93\u5165${e2.label || e2.key}`
  });
}
async function C(e2, t2) {
  try {
    let n2 = await (await fetch(e2)).blob();
    let r2 = window.URL.createObjectURL(n2);
    let i2 = document.createElement("a");
    i2.href = r2;
    i2.download = t2;
    document.body.appendChild(i2);
    i2.click();
    window.URL.revokeObjectURL(r2);
    document.body.removeChild(i2);
  } catch (t3) {
    console.error("Download failed:", t3);
    window.open(e2, "_blank");
  }
}
function ge({
  result: e2
}) {
  let t2 = e2.imageUrl || e2.videoUrl || e2.audioUrl;
  return (0, _.jsxs)("div", {
    className: "overflow-hidden rounded-xl border border-[#262626] bg-[#0f0f0f]",
    children: [e2.label ? (0, _.jsxs)("div", {
      className: "flex items-center justify-between border-b border-[#212121] px-3 py-2",
      children: [(0, _.jsx)("span", {
        className: "text-[12px] text-gray-400",
        children: e2.label
      }), t2 && (0, _.jsxs)("button", {
        onClick: () => {
          let t3 = e2.videoUrl || e2.imageUrl || e2.audioUrl || "";
          let n2 = e2.videoUrl ? ".mp4" : e2.imageUrl ? ".png" : ".mp3";
          C(t3, `result-${Date.now()}${n2}`);
        },
        className: "inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors",
        children: [(0, _.jsx)(l, {
          size: 12
        }), " 下载"]
      })]
    }) : t2 ? (0, _.jsx)("div", {
      className: "flex justify-end border-b border-[#212121] px-3 py-2",
      children: (0, _.jsxs)("button", {
        onClick: () => {
          let t3 = e2.videoUrl || e2.imageUrl || e2.audioUrl || "";
          let n2 = e2.videoUrl ? ".mp4" : e2.imageUrl ? ".png" : ".mp3";
          C(t3, `result-${Date.now()}${n2}`);
        },
        className: "inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors",
        children: [(0, _.jsx)(l, {
          size: 12
        }), " 下载"]
      })
    }) : null, e2.imageUrl ? (0, _.jsx)("img", {
      src: e2.imageUrl,
      alt: "result",
      className: "block w-full"
    }) : null, e2.videoUrl ? (0, _.jsx)("video", {
      src: e2.videoUrl,
      controls: true,
      className: "block w-full"
    }) : null, e2.audioUrl ? (0, _.jsx)("audio", {
      src: e2.audioUrl,
      controls: true,
      className: "block w-full p-3"
    }) : null, e2.text ? (0, _.jsx)("div", {
      className: "whitespace-pre-wrap px-4 py-3 text-sm leading-7 text-gray-200",
      children: e2.text
    }) : null]
  });
}
function w() {
  let e2 = new URLSearchParams(window.location.search);
  let t2 = e2.get("appId") || window.location.pathname.split("/").filter(Boolean).pop() || "";
  let n2 = e2.get("licenseToken") || void 0;
  let r2 = "http://192.168.1.6:3000";
  r2 = "";
  let i2 = {
    proxyBaseUrl: r2 || p || window.location.origin,
    proxyMode: "server-proxy",
    appId: t2,
    licenseToken: n2
  };
  return (0, _.jsx)(S, {
    app: {
      appId: t2
    },
    canvasProps: i2,
    licenseToken: n2
  });
}
export { w as default };