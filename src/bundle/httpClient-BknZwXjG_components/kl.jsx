// TODO(全局, 无需 import): r, n, willReadFrequently, i
import { e, t } from './shared.js';
import * as _shared from './shared.js';
// 本地可变状态（原 _shared.Dl/_shared.Ol 为 ESM 命名空间只读属性，无法直接写入；此处改为可写本地状态，仅本模块自维护两种尺寸的 canvas 缓存）
const _canvasCache = { Dl: _shared.Dl, Ol: _shared.Ol };
export default function kl(e, t, n) {
  let r = e === `a` ? _canvasCache.Dl : _canvasCache.Ol;
  if (!r) {
    r = document.createElement(`canvas`);
    if (e === `a`) {
      _canvasCache.Dl = r;
    } else {
      _canvasCache.Ol = r;
    }
  }
  if (r.width !== t) {
    r.width = t;
  }
  if (r.height !== n) {
    r.height = n;
  }
  let i = r.getContext(`2d`, {
    willReadFrequently: true
  });
  i.clearRect(0, 0, t, n);
  return i;
}