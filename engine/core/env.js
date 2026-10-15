// 运行环境（浏览器或 Node）。initEngine 时注入，见 engine/platform-browser.js、render/platform-node.js
// P 需要提供：kind, createCanvas(w,h), path2d(svg 路径串), loadImage(path), loadJSON(path), loadText(path), registerFont(alias, path), exists(path)
export const ENV = { P: null };

export const newCanvas = (w, h) => ENV.P.createCanvas(w, h);
