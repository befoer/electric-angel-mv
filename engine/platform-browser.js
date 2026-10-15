// 浏览器运行环境（预览页用）。路径相对项目根目录，预览服务在项目根目录启动
const url = p => '/' + p.split('/').map(encodeURIComponent).join('/');

export const browserPlatform = {
  kind: 'browser',
  createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  },
  path2d: d => new Path2D(d),
  loadImage(p) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('图片加载失败：' + p));
      im.src = url(p);
    });
  },
  async loadJSON(p) { const r = await fetch(url(p)); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); },
  async loadText(p) { const r = await fetch(url(p)); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.text(); },
  async loadBin(p) { const r = await fetch(url(p)); if (!r.ok) throw new Error(`${p}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); }, // 第十五轮：间奏二的分区图
  async exists(p) { try { return (await fetch(url(p), { method: 'HEAD' })).ok; } catch { return false; } },
  async registerFont(alias, p) {
    const f = new FontFace(alias, `url(${url(p)})`);
    await f.load();
    document.fonts.add(f);
  },
  url,
};
