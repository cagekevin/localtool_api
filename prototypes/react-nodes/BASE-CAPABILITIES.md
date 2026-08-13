# 已建好的通用能力（base/）— 直接用，别重复造轮子

> **这份文档是「能力清单」**：`src/components/base/` 下已经建好的通用地基。做新节点 / 新功能前先扫一遍，能直接用的就别自己写。
> 每项给「一句话 + 用法 + 复刻源」，照抄即可。
> 配套：`ARCHITECTURE.md`（为什么这样设计的规范）、`README.md`（启动/测试）。

---

## 一、节点外壳与通用控件（做新节点的骨架）

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **节点外壳** | `NodeShell.jsx` | 所有节点的公共骨架（尺寸/标题/端口/主容器背景/缩放） | 新节点用 `<NodeShell id label defaultTitle icon selected …>{children}</NodeShell>`，别手写外壳 |
| **hover 操作栏** | `HoverToolbar.jsx` | 节点 hover 顶部的胶囊按钮栏 | `<HoverToolbar buttons={[{key,icon,title,onClick,show}]} />` |
| **操作栏按钮** | `ToolbarButton.jsx` | hover 栏单个按钮 | 被 HoverToolbar 使用，一般不用直接 import |
| **生成/停止按钮** | `GenerateButton.jsx` | 底部「生成/停止/刷新」胶囊按钮 | `<GenerateButton loading onGenerate onStop cost />` |
| **模型下拉** | `ModelSelect.jsx` | 模型选择下拉（内置/第三方分组） | `<ModelSelect value onChange models={[{id,label,badge}]} />` |
| **提示词输入** | `PromptInput.jsx` | 提示词 textarea（带 @ 素材联想） | `<PromptInput value onChange />` |
| **展开面板** | `ExpandablePanel.jsx` | 节点展开/收起的内容面板 | `<ExpandablePanel expanded minWidth>{content}</ExpandablePanel>` |
| **全屏弹层** | `FullscreenModal.jsx` | 全屏编辑弹层（Esc/点击空白关闭、可拖改尺寸） | `<FullscreenModal open title onClose>{content}</FullscreenModal>` |
| **拖拽改尺寸手柄** | `ResizeFullscreenHandle.jsx` | 面板右下角拖拽手柄（改输入框/节点尺寸） | `<ResizeFullscreenHandle targetRef onResizeEnd />` |
| **节点尺寸 hook** | `hooks.js` | `useNodeResize` / `useSizeSync` / `useOutsideClick` / `isEditableTarget` | 主框拖拽 / 输入框拖拽 / 点击外部关闭 都从这取 |

> **做新节点的标准动作**：读 `ARCHITECTURE.md §7`（新增节点流程），用 NodeShell + 上面控件组装，别手写外壳/端口/背景。

---

## 二、画布级能力（宿主 App 已接好，扩展直接调）

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **左下角工具栏** | `CanvasToolbar.jsx` | 运行/整理/小地图/清理/适合视图/性能/缩放% | App 已接入；加按钮在此组件加 |
| **整理画布（dagre 自动排版）** | `useArrangeCanvas.js` | 按连线拓扑自动排列节点（Ctrl+L） | `const { arrange } = useArrangeCanvas(); arrange({nodes,edges,onArrange,onComplete})` |
| **整理确认弹窗** | `ArrangeConfirm.jsx` | 「是否保留整理结果」还原/保留 | App 已接；别处要确认弹窗可直接复用 |
| **性能模式 LOD 降级** | `useMediaDegrade.js` | 缩小时隐藏图片/视频/音频（lodLevel≥2 藏图、≥3 藏视频） | `const { isHidden } = useMediaDegrade(); {!isHidden('image') && <img/>}` |
| **节点按媒体比例自适应** | `useFitNodeRatio.js` | 图片/视频按真实宽高比调节点形状 | `const { fitFromImage, fitFromVideo } = useFitNodeRatio(id)` |
| **视频首帧封面** | `useVideoPoster.js` | 抓视频首帧作封面（未播放时） | `const poster = useVideoPoster(url, enabled)` |
| **媒体类型判断** | `mediaType.js` | 判断 URL/文件的 image/video/audio/text 类型 | `detectMediaType(url)` / `detectFileType(file)` |
| **画布快捷键** | `useCanvasShortcuts.js` | Ctrl+Z/Y/A/D/L、Q/W/E 快速建节点 | App 已接；加快捷键在此扩展 |
| **历史/撤销重做** | `useCanvasHistory.js` | 画布快照撤销栈 | App 已接；记录用 `history.record({nodes,edges})` |
| **右键菜单** | `useContextMenu.js` + `ContextMenu.jsx` | 空白/节点/多选右键菜单 | App 已接；加菜单项在 `menuItems` |
| **LOD 上下文** | `useLod.js` / `LodProvider.jsx` / `LodListener.jsx` | 视口缩放等级 0/1/2/3（性能降级数据源） | 节点用 `useLod().lodLevel` |

---

## 三、通知系统（统一 toast 地基）★ 打地基的核心

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **统一通知 store** | `toastStore.js` | 全局 toast 发布订阅 store | `import { showToast } from './base/toastStore.js'` → `showToast('消息', {type:'success'})` |
| **通知渲染容器** | `ToastContainer.jsx` | 顶部居中渲染 toast（状态色模板） | App 根已挂一次，别处**不需要再挂**，直接 showToast 即可 |

### showToast 用法（所有交互提醒统一走这里）
```js
import { showToast } from './components/base/toastStore.js'

showToast('已复制 3 个节点')                       // 默认 info(蓝)
showToast('已导入图片', { type: 'success' })      // 成功(绿)
showToast('生成失败，请重试', { type: 'error' })  // 错误(红)
showToast('额度不足', { type: 'warning' })        // 警告(黄)
showToast('处理中...', { duration: 0 })           // 0 = 不自动消失
```

### 约定（重要）
- **弹任何提示** → `showToast`（全项目统一，别各写各的浮层）
- type 四档对应 doc39 §3.2 状态色模板：success 绿 / error 红 / warning 黄 / info 蓝
- 位置固定在**顶部居中**（右上角/右下角留给未来的任务列表等）
- 接真系统：官方 `onShowToast` 回调直接指向 `showToast` 即可，无需额外封装

---

## 四、素材导入（拖入 / 粘贴）★ 已接好

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **拖入/粘贴素材** | `useAssetDropPaste.js` | 拖入/粘贴图片/视频/音频/文本建素材节点 | `const { onDragOver, onDrop, onPaste } = useAssetDropPaste({ addNode, screenToFlowPosition })` |
| **全局粘贴监听** | `useGlobalPaste(onPaste)` | 挂 window paste | App 已接；其它画布要粘贴复用 |

**映射规则（与官方一致）**：图片/视频/音频 → `imageNode`（ImageNode 自动识别类型展示）；文本 → `textNode`。
**注意**：这个 hook 会弹 toast（"已导入图片/视频/文本"），复用即自带反馈。

---

## 五、图片编辑（裁剪/标记/看大图）★ 已接好

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **全屏图片编辑器** | `ImageEditor.jsx` | 裁剪（react-image-crop）+ 画笔标记 + 撤销/清空/缩放 | `<ImageEditor imageUrl initialTool="crop"|"pencil" onSave onClose />` |

- ImageNode 的「裁剪」「标记」按钮已接入（只对图片显示）
- 图片**双击** = 查看大图（FullscreenModal）
- 接真系统：onSave 里改走「上传 localTool /files/ + 写回 imageUrl」即可

---

## 六、脚本盒子（剧本盒子）引擎

> 见 `ARCHITECTURE.md §七` 和 `SCRIPTBOX-HANDOFF.md`（专属交接文档）。
> `scriptBoxEngine.js` / `useScriptBoxEngine.js` / `useScriptBoxData.js` / `scriptBoxPrompts.js` 已建好。

---

## 七、接入清单速查（新功能先对号入座）

| 你想做什么 | 直接用 | 别自己造 |
|-----------|--------|---------|
| 弹个提示 | `showToast()` | ❌ 自己写浮层 |
| 新节点 | `NodeShell` + 各控件 | ❌ 手写外壳/端口/背景 |
| 节点缩小时隐藏媒体 | `useMediaDegrade()` | ❌ 手写 lodLevel 判断 |
| 图片/视频按比例自适应 | `useFitNodeRatio()` | ❌ 手写 resize 逻辑 |
| 视频封面 | `useVideoPoster()` | ❌ 手写抓帧 |
| 判断文件/URL 类型 | `detectMediaType/FileType` | ❌ 手写正则 |
| 画布支持拖入/粘贴素材 | `useAssetDropPaste()` | ❌ 手写 drop/paste |
| 整理画布 | `useArrangeCanvas()` | ❌ 手写 dagre |
| 裁剪/标记图片 | `<ImageEditor>` | ❌ 手写裁剪 |
| 缩略图替换（接真系统） | 复用 useMediaDegrade + 换 thumbnailUrl | ❌ 重写降级 |

---

## 八、新增能力该放哪（约定）

- **通用、无业务** → `base/`（如 mediaType、toastStore、useFitNodeRatio）
- **画布级交互** → `base/` + App.jsx 接入（如 useAssetDropPaste、CanvasToolbar）
- **某类节点专属** → 放对应节点组件内（如 ImageEditor 归 ImageNode）
- 新 base 能力记得：**加进本清单 + 写注释（为什么这样设计 + 接真系统路径）**，让后面的人能直接照用
