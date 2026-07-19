/* Share poster — Canvas 2D, Zhaphar poster grammar ported from the
   sister project (Zhaphar/website · lib/miniapp/posters.ts):
   900px wide × content-driven height, 96px margins, right edges aligned
   to 804, warm paper + hairlines (no outer frame), Tsanger serif +
   JetBrains-style mono, single-line title sized down to fit (the web
   poster's ImageResponse twin uses the same rule — the two posters are
   meant to be identical), accent stop-dot, vertical-hairline kicker
   quote, muted lede + poster summary, a fixed 214px footer band with a
   frame-less QR on the right. Accent (Kimi blue) appears exactly twice:
   the masthead dash and the stop-dot.
   Returns the drawn poster's temp file path — the read page's share
   sheet previews it inline and offers save / forward. */

const W = 900;
const MARGIN = 96;
const RIGHT = 804;
const FOOTER = 214;
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

function hairline(ctx, x1, x2, y, color = C.rule) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y + 0.5);
  ctx.lineTo(x2, y + 0.5);
  ctx.stroke();
}

/* Two passes on the same ctx: measure first to size the canvas, then
   draw into the resized canvas (resizing resets the context state). */
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
  canvas.height = 10 * dpr;
  ctx.scale(dpr, dpr);

  /* ── pass 1 · layout ──
     Composition (Zhaphar grammar): masthead → chapter label → title
     (ONE line, sized down to fit — same rule as the web poster's
     ImageResponse twin) → the chapter's kicker quote with a vertical
     hairline (the protagonist) → a short muted lede → poster summary →
     the fixed 214px footer band. */
  const contentW = RIGHT - MARGIN;
  let size = 66;
  for (; size > 30; size -= 2) {
    ctx.font = `600 ${size}px ${SERIF}`;
    if (ctx.measureText(info.title).width <= contentW) break;
  }
  const titleLines =
    ctx.measureText(info.title).width <= contentW
      ? [info.title]
      : wrapText(ctx, info.title, contentW, 2);
  const titleLH = Math.round(size * 1.23);
  const titleFirstBaseline = 300 + size;
  const titleEndY = titleFirstBaseline + (titleLines.length - 1) * titleLH;

  let kickerLines = [];
  if (info.kicker) {
    ctx.font = `600 30px ${SERIF}`;
    kickerLines = wrapText(ctx, info.kicker, contentW - 34, 2);
  }
  const kickerLH = 46;
  const kickerTop = titleEndY + 78;
  const kickerEndY = kickerLines.length
    ? kickerTop + (kickerLines.length - 1) * kickerLH
    : titleEndY;

  let ledeLines = [];
  if (info.lede) {
    ctx.font = `400 26px ${SERIF}`;
    ledeLines = wrapText(ctx, info.lede, contentW, 2);
  }
  const ledeLH = 40;
  const ledeTop = (kickerLines.length ? kickerEndY : titleEndY) + 56;
  const ledeEndY = ledeLines.length
    ? ledeTop + (ledeLines.length - 1) * ledeLH
    : kickerEndY;

  /* poster summary — the middle-band companion (meta.posterSummary,
     served by the chapter API). Same block exists on the web poster. */
  let summaryLines = [];
  if (info.summary) {
    ctx.font = `400 24px ${SERIF}`;
    summaryLines = wrapText(ctx, info.summary, contentW, 3);
  }
  const summaryLH = 40;
  const summaryTop = (ledeLines.length ? ledeEndY : kickerEndY) + 36;
  const summaryEndY = summaryLines.length
    ? summaryTop + (summaryLines.length - 1) * summaryLH
    : ledeEndY;

  const contentBottom =
    (summaryLines.length
      ? summaryEndY
      : ledeLines.length
        ? ledeEndY
        : kickerEndY) + 8;
  const footerY = contentBottom + 46;
  const H = Math.max(765, footerY + FOOTER);

  /* ── pass 2 · draw (resizing resets state) ── */
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // masthead — accent dash + spaced mono brand + serial, hairline
  ctx.fillStyle = C.accent;
  ctx.fillRect(MARGIN, 132, 42, 3);
  ctx.fillStyle = C.ink;
  ctx.font = `600 15px ${MONO}`;
  drawSpaced(ctx, "KIMI COOKBOOK", MARGIN + 66, 140, 4);
  ctx.fillStyle = C.muted;
  drawSpacedRight(ctx, "NO. 01", RIGHT, 140, 4);
  hairline(ctx, MARGIN, RIGHT, 180, "rgba(58,58,58,0.34)");

  // chapter label
  ctx.fillStyle = C.muted;
  ctx.font = `600 14px ${MONO}`;
  drawSpaced(ctx, info.number || "", MARGIN, 236, 3);

  // title — calm: capped at two lines
  ctx.fillStyle = C.ink;
  ctx.font = `600 ${size}px ${SERIF}`;
  let lastWidth = 0;
  titleLines.forEach((line, i) => {
    const y = titleFirstBaseline + i * titleLH;
    ctx.fillText(line, MARGIN, y);
    if (i === titleLines.length - 1) lastWidth = ctx.measureText(line).width;
  });

  // accent stop-dot — pinned at the last line's end, only when the
  // RENDERED last line doesn't already close itself (a clamp-added … or
  // a native 。!?… counts as closed; dotting after it is a typo, not a
  // signature).
  const renderedLast = titleLines[titleLines.length - 1] || "";
  if (!/[。!?…；，、：:;,.!?]$/.test(renderedLast.trim())) {
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(
      Math.min(RIGHT - 16, MARGIN + lastWidth + 20),
      titleEndY - size * 0.12,
      7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // the kicker quote — vertical hairline, the protagonist
  if (kickerLines.length) {
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN + 0.5, kickerTop - 24);
    ctx.lineTo(MARGIN + 0.5, kickerEndY + 12);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = `600 30px ${SERIF}`;
    kickerLines.forEach((line, i) => {
      ctx.fillText(line, MARGIN + 34, kickerTop + i * kickerLH);
    });
  }

  // lede — short, muted, metadata weight
  if (ledeLines.length) {
    ctx.fillStyle = C.ink2;
    ctx.font = `400 26px ${SERIF}`;
    ledeLines.forEach((line, i) => {
      ctx.fillText(line, MARGIN, ledeTop + i * ledeLH);
    });
  }

  // poster summary — muted, same weight as the lede's companion band
  if (summaryLines.length) {
    ctx.fillStyle = C.ink2;
    ctx.font = `400 24px ${SERIF}`;
    summaryLines.forEach((line, i) => {
      ctx.fillText(line, MARGIN, summaryTop + i * summaryLH);
    });
  }

  // footer band — fixed 214px: hairline, brand + date left, QR right
  const fy = H - FOOTER;
  hairline(ctx, MARGIN, RIGHT, fy);
  ctx.fillStyle = C.ink;
  ctx.font = `600 20px ${SERIF}`;
  ctx.fillText("Kimi · 从长文本到一套 agent 栈", MARGIN, fy + 78);
  ctx.fillStyle = C.muted;
  ctx.font = `600 13px ${MONO}`;
  const today = new Date();
  const stamp = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  drawSpaced(ctx, stamp, MARGIN, fy + 116, 2);

  try {
    const img = canvas.createImage();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = `https://kimi.read.wiki/api/mp/qr.png?url=${encodeURIComponent(info.url)}`;
    });
    const qrSize = 132;
    ctx.drawImage(img, RIGHT - qrSize, fy + 41, qrSize, qrSize);
    ctx.fillStyle = C.muted;
    ctx.font = `500 15px ${SERIF}`;
    const cap = "扫码读全文";
    const capW = ctx.measureText(cap).width;
    ctx.fillText(cap, RIGHT - qrSize + (qrSize - capW) / 2, fy + 41 + qrSize + 28);
  } catch (e) {
    /* no QR — the poster still stands (footer text carries the URL) */
  }

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
  return tempFilePath;
}
