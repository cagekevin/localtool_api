/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /**
       * 统一 z-index 语义令牌（避免散落魔法数字导致层级冲突）。
       *
       * 排序（从低到高）：
       *   base 0 < node-inner 10/20 < dropdown 50 < float 100 < topnav 200
       *   < canvas-tools 700 < sidebar 800 < popover 1000 < modal 9999
       *   < modal-raise 10000 < modal-action 10001 < overlay-error 99999
       *   < suggest 999999 < ceiling 2147483647（全屏编辑器 / Toast / 错误全屏）
       *
       * 关键约定：
       *   - 侧边栏(sidebar 800) 必须盖过左下角小地图与工具栏(canvas-tools 700)，
       *     这样侧边栏展开时能盖住画布左下角的那一排工具/小地图。
       *   - 全屏弹窗一律用 modal(9999) 及以上，禁止低于 modal 的浮层压过弹窗。
       *   - 新增浮层时优先复用现有令牌，不要直接写数字。
       */
      zIndex: {
        base: '0',
        'node-inner': '10',
        'node-inner-2': '20',
        dropdown: '50',
        float: '100',
        topnav: '200',
        'canvas-tools': '700',
        sidebar: '800',
        popover: '1000',
        modal: '9999',
        'modal-raise': '10000',
        'modal-action': '10001',
        'overlay-error': '99999',
        suggest: '999999',
        'ceiling-1': '2147483645',
        'ceiling-2': '2147483646',
        ceiling: '2147483647',
      },
    },
  },
  plugins: [],
}
