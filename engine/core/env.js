// 运行环境（浏览器或 Node）。initEngine 时注入，见 engine/platform-browser.js、render/platform-node.js
// P 需要提供：kind, createCanvas(w,h), path2d(svg 路径串), loadImage(path), loadJSON(path), loadText(path), registerFont(alias, path), exists(path)
// SS：超采样倍数（见下面 hiCanvas）。1 = 不超采样
export const ENV = { P: null, SS: 1 };

export const newCanvas = (w, h) => ENV.P.createCanvas(w, h);

// ---------------------------------------------------------------- 超采样（第二十八轮，用户：视频改成 2560×1440，后来定成直接放大 2 倍出 3840×2160）
// 镜头里的坐标一律还是 W×H（1920×1080）的逻辑像素。出片时主画布和"高清"画布（hiCanvas）底层是 SS 倍大小、自带 SS 倍的变换，
// 对外仍按逻辑像素：width / height、setTransform / getTransform、getImageData / putImageData（取样时缩回逻辑尺寸）、
// filter 和阴影里的像素数（Skia 里这几样不跟变换缩放，所以这里替它乘上 SS），以及把它当源图 drawImage 时的源矩形——镜头代码不用改。
// 只有显式要的画布是高清的（主画布、整屏缓冲、图集、立绘缓存等，见 engine/README.md「第二十八轮补充」）；其余照旧是逻辑尺寸，画上去时跟着放大。
// SS 只取整数（现在是 2，正好出 3840×2160），不取 4/3 这类：非整数倍时相邻色块的接缝落在半个像素上，会出一条条浅色细缝。
// SS = 1（浏览器预览、总览图、封面、GitHub 版）时 hiCanvas 就是 newCanvas，什么都不变。

const protoOf = o => Object.getPrototypeOf(o);
const descOf = (o, k) => { for (let p = protoOf(o); p; p = protoOf(p)) { const d = Object.getOwnPropertyDescriptor(p, k); if (d) return d; } return null; };
const PX = /(-?\d*\.?\d+)px/g;
let NATIVE = null; // 原生的 drawImage / setTransform / getTransform / getImageData / putImageData

export function setSuperSample(ss) {
  ENV.SS = ss;
  if (ss === 1 || NATIVE) return;
  const P = protoOf(ENV.P.createCanvas(1, 1).getContext('2d'));
  NATIVE = { drawImage: P.drawImage, setTransform: P.setTransform, getTransform: P.getTransform, getImageData: P.getImageData, putImageData: P.putImageData };
  const D = P.drawImage;
  // 高清画布当源图：3 个参数时按逻辑尺寸画；9 个参数时源矩形是逻辑像素，换成底层像素
  P.drawImage = function (img, a, b, c, d, e, f, g, h) {
    const s = img && img.__ss;
    if (!s) return D.apply(this, arguments);
    if (arguments.length === 3) return D.call(this, img, 0, 0, img.__dw, img.__dh, a, b, img.width, img.height);
    if (arguments.length === 5) return D.call(this, img, 0, 0, img.__dw, img.__dh, a, b, c, d);
    return D.call(this, img, a * s, b * s, c * s, d * s, e, f, g, h);
  };
}

export function hiCanvas(w, h) {
  const ss = ENV.SS;
  if (ss === 1) return newCanvas(w, h);
  const dw = Math.ceil(w * ss), dh = Math.ceil(h * ss), cv = ENV.P.createCanvas(dw, dh), c = cv.getContext('2d'), N = NATIVE;
  Object.defineProperties(cv, { width: { get: () => w }, height: { get: () => h }, __ss: { value: ss }, __dw: { value: dw }, __dh: { value: dh } });
  c.setTransform = function (a, b, cc, d, e, f) { if (typeof a === 'object') ({ a, b, c: cc, d, e, f } = a); N.setTransform.call(this, a * ss, b * ss, cc * ss, d * ss, e * ss, f * ss); };
  c.resetTransform = function () { N.setTransform.call(this, ss, 0, 0, ss, 0, 0); };
  c.getTransform = function () { const m = N.getTransform.call(this); m.a /= ss; m.b /= ss; m.c /= ss; m.d /= ss; m.e /= ss; m.f /= ss; return m; };
  for (const k of ['shadowBlur', 'shadowOffsetX', 'shadowOffsetY']) {
    const d = descOf(c, k);
    Object.defineProperty(c, k, { get() { return d.get.call(this) / ss; }, set(v) { d.set.call(this, v * ss); }, configurable: true });
  }
  { const d = descOf(c, 'filter');
    Object.defineProperty(c, 'filter', { get() { return String(d.get.call(this)).replace(PX, (_, n) => `${+n / ss}px`); }, set(v) { d.set.call(this, String(v).replace(PX, (_, n) => `${+n * ss}px`)); }, configurable: true }); }
  // 像素读写按逻辑像素：读时把这块缩回逻辑尺寸，写时按最近邻放大回去（和 SS = 1 时的结果只差插值）
  c.getImageData = function (x, y, w2, h2) {
    const t = ENV.P.createCanvas(w2, h2), tc = t.getContext('2d');
    tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
    N.drawImage.call(tc, cv, x * ss, y * ss, w2 * ss, h2 * ss, 0, 0, w2, h2);
    return N.getImageData.call(tc, 0, 0, w2, h2);
  };
  c.putImageData = function (im, x, y) {
    const t = ENV.P.createCanvas(im.width, im.height);
    N.putImageData.call(t.getContext('2d'), im, 0, 0);
    this.save(); N.setTransform.call(this, 1, 0, 0, 1, 0, 0);
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; this.imageSmoothingEnabled = false; descOf(c, 'filter').set.call(this, 'none');
    this.clearRect(x * ss, y * ss, im.width * ss, im.height * ss);
    N.drawImage.call(this, t, x * ss, y * ss, im.width * ss, im.height * ss);
    this.restore();
  };
  N.setTransform.call(c, ss, 0, 0, ss, 0, 0);
  return cv;
}
