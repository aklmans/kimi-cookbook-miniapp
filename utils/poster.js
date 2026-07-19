/* Share poster — Canvas 2D, drawn off-screen and handed to the reader
   via wx.previewImage (long-press to save / forward — zero permissions,
   pattern from the sister Taro app). Fixed warm-paper palette: the
   poster is print collateral, not a theme surface. */

const W = 750;
const H = 940;
const C = {
  bg: "#fafafa",
  ink: "#1a1a1a",
  ink2: "#3a3a3a",
  muted: "#6b6b6b",
  rule: "#c0bfba",
  accent: "#1783ff",
};
const SERIF = '"TsangerJinKai02-W05","Songti SC","STSong",serif';
const MONO = '"SF Mono",Menlo,Consolas,monospace';

/** CJK-aware line wrapping: break Latin on words, CJK anywhere, ellipsize. */
function wrapText(ctx, text, maxWidth, maxLines) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const tokens = /\s/.test(value)
    ? value.split(/(\s+)/).filter(Boolean)
    : Array.from(value);
  const lines = [];
  let line = "";
  for (const token of tokens) {
    const next = line + token;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line.trimEnd());
      line = token.trimStart();
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line.trimEnd());
  if (lines.length === maxLines && tokens.join("").length > lines.join("").length) {
    let last = lines[lines.length - 1];
    while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/** canvas has no letter-spacing — draw spaced mono one char at a time. */
function drawSpaced(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - spacing;
}

function drawSpacedRight(ctx, text, rightX, y, spacing) {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  drawSpaced(ctx, text, rightX - total, y, spacing);
}

function hairline(ctx, x1, x2, y) {
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y + 0.5);
  ctx.lineTo(x2, y + 0.5);
  ctx.stroke();
}

/**
 * Draw the chapter poster and preview it.
 * @param {object} page the read page instance (for SelectorQuery context)
 * @param {{number:string,title:string,lede:string}} info
 */
export async function makeChapterPoster(page, info) {
  const [field] = await new Promise((resolve) => {
    page
      .createSelectorQuery()
      .select("#sharePoster")
      .fields({ node: true, size: true })
      .exec((res) => resolve(res));
  });
  if (!field || !field.node) {
    wx.showToast({ title: "海报生成失败", icon: "none" });
    return;
  }
  const canvas = field.node;
  const ctx = canvas.getContext("2d");
  let dpr = 2;
  try {
    dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2;
  } catch (e) {
    /* keep 2 */
  }
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // paper
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // masthead
  const px = 64;
  ctx.fillStyle = C.muted;
  ctx.font = `600 20px ${MONO}`;
  drawSpaced(ctx, "KIMI COOKBOOK", px, 88, 8);
  drawSpacedRight(ctx, "NO. 01", W - px, 88, 8);
  hairline(ctx, px, W - px, 116);

  // moon tile
  try {
    const img = canvas.createImage();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = "/assets/moon-tile.png";
    });
    ctx.drawImage(img, px, 168, 132, 132);
  } catch (e) {
    /* tile is decorative — the poster still reads without it */
  }

  // chapter number
  ctx.fillStyle = C.muted;
  ctx.font = `600 20px ${MONO}`;
  drawSpaced(ctx, info.number || "", px + 170, 236, 3);

  // title — the protagonist
  ctx.fillStyle = C.ink;
  ctx.font = `600 46px ${SERIF}`;
  const titleLines = wrapText(ctx, info.title, W - px * 2, 2);
  let y = 400;
  for (const line of titleLines) {
    ctx.fillText(line, px, y);
    y += 64;
  }

  // accent rule
  ctx.fillStyle = C.accent;
  ctx.fillRect(px, y - 12, 56, 5);
  y += 40;

  // lede
  if (info.lede) {
    ctx.fillStyle = C.ink2;
    ctx.font = `400 26px ${SERIF}`;
    for (const line of wrapText(ctx, info.lede, W - px * 2, 4)) {
      ctx.fillText(line, px, y);
      y += 44;
    }
  }

  // footer
  hairline(ctx, px, W - px, H - 116);
  ctx.fillStyle = C.muted;
  ctx.font = `600 20px ${MONO}`;
  drawSpaced(ctx, "kimi.read.wiki", px, H - 66, 4);
  drawSpacedRight(ctx, "ZHAPAR", W - px, H - 66, 4);

  // export — wait one frame so the first capture isn't blank
  await new Promise((r) => canvas.requestAnimationFrame(r));
  const { tempFilePath } = await wx.canvasToTempFilePath({
    canvas,
    x: 0,
    y: 0,
    width: W,
    height: H,
    destWidth: W * dpr,
    destHeight: H * dpr,
    fileType: "png",
  });
  await wx.previewImage({ current: tempFilePath, urls: [tempFilePath] });
}
