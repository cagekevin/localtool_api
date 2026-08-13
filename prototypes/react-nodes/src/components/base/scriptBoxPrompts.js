/**
 * 剧本盒子 —— 纯函数层（无副作用，对应真实系统的 scriptBoxPrompts.js / shared.js）。
 *
 * 职责：
 *  - 默认提示词模板（与 c_.jsx 设置弹窗默认值逐字一致）
 *  - ZgPrompt：资产生图提示词拼装
 *  - buildShotPrompts：单个分镜的生图/生视频提示词拼装
 *  - buildShots / buildAssets：按剧情/风格生成初始分镜与资产（假引擎用）
 *
 * 铁律：本文件 100% 纯函数，无 React、无 state、无副作用。
 * UI 与引擎都从这里取函数，保证「依赖单向：UI→引擎→纯函数」。
 */

/** 角色 / 场景 / 道具 参考图模板（逐字对应 c_.jsx 设置弹窗默认值） */
export const ASSET_TEMPLATES = {
  character: `高质量专业角色设定图，横向构图，纯白色纯净背景，中性摄影棚灯光，平光布光；布局结构：正面半身特写 + 全身正面居中 + 左侧面视图 + 背面视图，无任何道具或背景物体。光影：中性摄影棚灯光，柔和的前侧光，清晰的轮廓定义，自然的肤色，面部清晰服装可辨识，平视镜头，完整全身，无裁剪。不得出现任何道具 / 武器 / 食物 / 饮料 / 手持物（角色空手）；不得出现复杂动作、夸张表情、面部遮挡；不得出现环境背景（仅白色）；不得出现其他角色；确保所有视图中的面部特征、发型、体型和服装保持一致；不得出现文字、水印、标签、UI元素；无背景场景，无过度风格化。`,
  scene: `高质量专业场景设定图，横向构图，以 2 行 2 列的干净网格四等分整齐排版，每个格子都是独立的 16:9 横向画面，展示同一场景的四个大全景视角（1为正面中心线大全景视图，镜头正对场景中心轴，构图严格居中，画面同时包含顶面与底面，尽量展示完整空间层次、更多环境细节和深景深；2以1的中心线为参考，摄像机移动到场景左前方45度位置的大全景视图，镜头仍对准场景核心区域；3为以1的中心线为参考，摄像机移动到场景右前方45度位置的大全景视图；4为镜头在室内最深处向外拍摄的正中心全景图。四个视角必须表现同一地点、同一时间、同一天气、同一光源、同一空间结构和同一美术风格。环境清晰，细节丰富，景深较深，光影自然，专业摄影，超清画质。不得出现任何人物（这是空场景参考图），也不得出现人群、背影、剪影、人脸、手脚、人物倒影、人物影子、照片人物、屏幕人物、镜中人物、剧情事件、人物活动；不得让四个视角表现成四个不同场景；不得改变建筑结构、空间比例、主体位置、材质、色彩、天气、时间段或光源方向；画面构图不得倾斜、透视畸变、广角畸变、变形、扭曲；不得出现鱼眼视角、斜角、极端俯视、极端仰视；正面视图必须居中、对称、中心线构图；左前方 45 度、右前方 45 度和背后视角必须保持镜头稳定、空间连贯、比例一致；禁止模糊、低画质；禁止景深太浅；不得出现文字、水印、签名、边框、标签、UI元素、杂乱元素。`,
  prop: `高质量写实道具多角度展示图，横向构图，以 2 行 3 列的干净网格整齐排版，展示道具的六个极正视角。纯白色纯净背景，专业产品影棚摄影，标准六视图参考。六视图包括：绝对正前方视图、绝对正后方视图、绝对左侧视图、绝对右侧视图、绝对正上方俯拍视图、绝对正下方仰拍视图。所有视图必须是同一件道具，材质、颜色、比例、结构完全一致。使用超长焦镜头或移轴镜头效果，将透视变形降到最低，物体所有本该平行的边缘在画面中保持平行，接近正交投影。每个视图都像在专业产品影棚中用三脚架精密校准拍摄，构图绝对端正，物体在每个格子中居中，无任何倾斜、旋转或透视畸变。画面出不得出现任何人物、角色、人群、人影等；不得出现手、脚、人脸、场景、建筑、自然景观；无其他道具；无文字、无水印、无 logo、无 UI 元素，不要任何剧情事件，保持道具本体清晰、保持完整轮廓、保持所有角度的材质和结构一致。`
}

/** 剧本生成系统提示词（逐字对应 c_.jsx 的 SCRIPT_WRITER_SYSTEM，只返回 JSON 分镜+资产） */
export const SCRIPT_WRITER_SYSTEM = `你是顶级爆款短剧编剧 + 资深影视分镜师，集编剧、导演、制片人视角于一身，精通短剧/网剧/短视频的爆款公式。
你的创作哲学：节奏第一、情绪至上、悬念不断、前3秒定生死、强冲突×高密度爽点×持续悬念×极致情绪。

【创作流程（必须先想清楚再出分镜，禁止直接平铺直叙）】
1. 先在脑中规划一条清晰故事线：明确题材类型、主角的欲望与成长弧线、核心冲突、反派动机；
2. 用「事件→反应→反转→再反应（设局→入局→破局→新局）」组织剧情，保证冲突逐级升级；
3. 按时间结构铺排：开场即冲突锚定 → 情绪爆破 → 反转打脸 → 结尾留悬念钩子；
4. 再把这条故事线拆成连续、有因果递进的分镜，每个分镜承担明确的叙事功能，不要无效镜头、不要重复镜头、不要流水账；
5. 镜头语言要有变化：景别（大远景/全景/中景/近景/特写）与运镜（推/拉/摇/移/跟/升降）按情绪需要切换，关键情绪点用特写。

【输出格式】严格输出一个 JSON 对象（只返回纯 JSON，不要解释、不要 Markdown 代码块）：
{"projectName":"根据故事生成的简洁项目名称，2至8个中文字符，例如：小红帽","globalStyle":"整部片子的统一视觉风格，例如：中世纪童话·皮克斯3D","logline":"一句话故事核心（用于自检，可选）","shots":[{"index":1,"duration":"5s","description":"画面描述：聚焦这一镜要呈现的画面与动作，凡出现 assets 中的角色/场景/道具，必须写成 @名称 形式，例如 @小红帽 走进 @幽暗森林","shotType":"景别","lighting":"光影氛围","dialogue":"该镜对白或旁白（如有）","sound":"音效（如有）","motion":"运镜"}],"assets":[{"category":"character|scene|prop","name":"名称","description":"主体外观描述，详细具体（角色：体型/发型/五官/瞳色/肤色/服装/配饰/神态；场景：环境/前景背景/氛围/光线；道具：形状/材质/颜色/细节），只描述主体本身，不要写构图/视角/布光/负面词，这些由系统自动补全"}]}
【硬性要求】assets 的 name 必须与 shots 的 description 中 @ 引用的名称完全一致；分镜数量与时长要与剧情体量匹配，叙事连贯、有头有尾。`

/** 分镜导演系统提示词（逐字对应 c_.jsx 的 SHOT_DIRECTOR_SYSTEM，只返回 JSON prompt/videoPrompt） */
export const SHOT_DIRECTOR_SYSTEM = `你是资深电影导演、分镜设计师、AI绘画与AI视频提示词工程师。根据给定的单个分镜资料，输出一个严格 JSON 对象：
{"prompt":"用于生成静态画面的详细图像提示词","videoPrompt":"用于生成该镜头视频的详细提示词"}

【总体要求】
1. prompt 与 videoPrompt 必须围绕同一个镜头，主体身份、服装、道具、场景、时间、光线和空间关系完全一致。
2. 两个字段都要信息充足、语言连贯、可直接交给生成模型使用；每个字段建议 450 至 700 个中文字符，最低不得少于 400 个中文字符，禁止用空洞形容词凑字数。
3. 画面资料中的 @名称 是资产绑定标记，必须逐字原样保留，不能删减、改写、合并或替换成"角色""人物""主体"等泛称。

【prompt（生图）要求】
只写单帧中能够被摄像机看见的内容。按主体身份与外观、精确动作和姿态、角色间距离与视线关系、前中后景环境、关键道具位置、景别与构图、镜头焦段和视角、光源方向与明暗层次、色彩关系、材质纹理、空气透视、电影美术风格的顺序组织。明确每个 @资产 在画面中的位置、朝向、遮挡和互动。不得写对白、旁白、声音、音效、配乐、字幕、心理活动、画外信息或生成操作说明。

【videoPrompt（生视频）要求】
以 prompt 的画面状态为起点，详细描述镜头在指定时间内如何连续发展：起始画面、运镜方向和速度、焦点迁移、主体逐步动作、表情与视线变化、衣物毛发和环境物体的次级运动、光影与粒子变化、动作节奏、结束画面和停顿方式。避免突然跳切、瞬移、身份漂移和无因果动作。
必须加入本镜头提供的对白/旁白和音效，而且必须保留具体说话者姓名与完整原句。格式写成"角色名说：'完整台词'"，旁白写成"旁白：'完整原句'"，音效写成"环境音/动作音：具体声音内容"。严禁把具体姓名泛化为"角色说""人物说""他说/她说"，严禁遗漏、缩写或擅自改写台词。若资料明确没有对白或音效，才可不写。

只返回可解析的纯 JSON，不要解释，不要 Markdown，不要在 JSON 前后添加任何文字。`

/** 资产生图提示词拼装（对应 shared.js Zg）：`[视觉风格：xx] + desc + 句号 + 模板` */
export function ZgPrompt(category, desc, style, customTemplates) {
  const cat = ['character', 'scene', 'prop'].includes(category) ? category : 'character'
  const d = (desc || '').trim()
  const tpl = (customTemplates && customTemplates[cat]) || ASSET_TEMPLATES[cat]
  const body = `${d}${d && !/[。.!!？?]$/.test(d) ? '。' : ''}${tpl}`
  return (style ? `[视觉风格：${style}]` : '') + body
}

/** 单分镜对白数组 → 可读文本（"台词/旁白: text" 用 / 连接） */
export function dialogueText(arr) {
  const list = Array.isArray(arr) ? arr : []
  if (!list.length) return ''
  return list
    .map((d) => (d.kind === '旁白' ? `[旁白] ${d.text}` : `${d.role || '台词'}: ${d.text}`))
    .join(' / ')
}

/** @资产名 → 青色高亮 HTML（用于画面描述展示） */
export function hlAt(text) {
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  return esc(text).replace(/@([\u4e00-\u9fa5a-zA-Z0-9]+)/g, '<span class="at">@$1</span>')
}

/** 单个分镜的生图/生视频提示词（对应 buildShotPrompts，详实模板） */
export function buildShotPrompts(shot, { imageConstraint, videoConstraint } = {}) {
  const dlg = dialogueText(shot.dialogue)
  const base = `电影感画面，${shot.description}${shot.shotType ? `，景别：${shot.shotType}` : ''}${shot.lighting ? `，光影：${shot.lighting}` : ''}，运镜：${shot.motion || '固定'}`
  shot.prompt = `${base}${imageConstraint ? `，全局约束：${imageConstraint}` : ''}`
  shot.videoPrompt = `镜头时长 ${shot.duration || '5s'}，${base}${dlg ? `，对白/旁白：${dlg}` : ''}，音效：${shot.sound || ''}${videoConstraint ? `，全局约束：${videoConstraint}` : ''}`.trim()
  return shot
}

/** 候选下拉项（表格用） */
export const SHOT_TYPES = ['特写', '近景', '中景', '全景', '大远景']
export const LIGHTS = ['自然光', '暖光', '冷光', '逆光', '烛光', '夜光', '电影感']
export const SOUNDS = ['环境音', '动作音', '鸟鸣', '风声', '翻页声', '雨声', '水声']
export const MOTIONS = ['固定', '缓慢推进', '推', '拉', '横摇跟随', '跟随', '环绕']

/** 分镜模板（buildShots 循环取用） */
const SHOT_TPL = [
  { desc: '@小马 站在 @河岸边 眺望对岸，晨光洒在草地上。', shotType: '中景', lighting: '自然光', dialogue: [{ kind: '台词', role: '小马', text: '对岸会有更好的草地吗？' }], sound: '环境音', motion: '缓慢推进' },
  { desc: '@老牛 缓步走近 @小马，目光温和。', shotType: '全景', lighting: '暖光', dialogue: [{ kind: '旁白', role: '', text: '这头老牛，见过太多四季。' }], sound: '环境音', motion: '横摇跟随' },
  { desc: '@松鼠 从树梢跃下，落在 @小马 的背上。', shotType: '近景', lighting: '自然光', dialogue: [{ kind: '台词', role: '松鼠', text: '我带你去看最甜的野莓！' }], sound: '动作音', motion: '固定' },
  { desc: '他们一起走向 @森林 深处，@马妈妈 在身后目送。', shotType: '大远景', lighting: '逆光', dialogue: [], sound: '鸟鸣', motion: '拉' },
  { desc: '夜幕降临，@旧书店 的灯还亮着。', shotType: '特写', lighting: '烛光', dialogue: [{ kind: '旁白', role: '', text: '有些路，走过了才知道方向。' }], sound: '翻页声', motion: '推' }
]

/** 资产池（buildAssets 用） */
const ASSET_POOL = [
  { name: '小马', cat: 'character', desc: '矮脚小马，鬃毛卷曲，眼神明亮，四肢矫健' },
  { name: '老牛', cat: 'character', desc: '沉稳老牛，眼神温和，皮毛厚实，体格健壮' },
  { name: '松鼠', cat: 'character', desc: '毛茸茸松鼠，尾巴蓬松，机灵可爱，眼睛圆亮' },
  { name: '马妈妈', cat: 'character', desc: '成年母马，毛色温暖淡棕，姿态优雅，鬃毛顺滑' },
  { name: '河岸边', cat: 'scene', desc: '河岸青草地，波光粼粼，水草摇曳，晨雾缭绕' },
  { name: '森林', cat: 'scene', desc: '晨雾中的森林小径，光线穿过树梢，苔藓湿润' },
  { name: '旧书店', cat: 'scene', desc: '拥挤的二手书店，木架到顶，灯光昏黄，灰尘飞舞' },
  { name: '谷仓', cat: 'scene', desc: '木质谷仓，堆满干草，阳光斜照，木纹斑驳' },
  { name: '画册', cat: 'prop', desc: '皮质封面无字画册，边角磨损，封皮暗红' },
  { name: '怀表', cat: 'prop', desc: '银壳怀表，指针停摆，链坠精致，表盘泛黄' }
]

/** 按镜头数生成分镜数组（含提示词），无副作用 */
export function buildShots(n) {
  const shots = []
  for (let i = 0; i < n; i++) {
    const t = SHOT_TPL[i % SHOT_TPL.length]
    const dur = 3 + (i % 3)
    const shot = {
      id: i + 1,
      index: i + 1,
      duration: `${dur}s`,
      description: t.desc,
      shotType: t.shotType,
      lighting: t.lighting,
      dialogue: t.dialogue.map((d) => ({ ...d })),
      sound: t.sound,
      motion: t.motion,
      grid: 0,
      prompt: '',
      videoPrompt: '',
      promptLoading: false,
      connImg: false,
      connVid: false
    }
    buildShotPrompts(shot)
    shots.push(shot)
  }
  return shots
}

/** 生成资产数组（角色/场景/道具三栏，prompt 走 ZgPrompt），无副作用 */
export function buildAssets(style, customTemplates) {
  return ASSET_POOL.map((a) => ({
    id: a.name,
    category: a.cat,
    name: a.name,
    description: a.desc,
    prompt: ZgPrompt(a.cat, a.desc, style, customTemplates),
    imageUrl: '',
    thumbnailUrl: '',
    has: false,
    loading: false,
    videoStatus: ''
  }))
}
