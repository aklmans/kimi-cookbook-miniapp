/* Share posters — Canvas 2D, Zhaphar poster grammar ported from the
   sister project (Zhaphar/website · lib/miniapp/posters.ts):
   900px wide × content-driven height, 96px margins, right edges aligned
   to 804, warm paper + hairlines (no outer frame), Tsanger serif +
   JetBrains-style mono, title font-size LADDER (largest that fits, not
   a fixed size), accent stop-dot, vertical-hairline quote, a fixed 214px
   footer band with a frame-less QR on the right. Accent (Kimi blue)
   appears exactly twice: the masthead dash and the stop-dot.
   Two entries share one generic draw:
   - makeChapterPoster — chapter share (read page): number label + title +
     kicker quote + lede
   - makeBookPoster — whole-book share (book page): stats label + cover
     title + longer lede
   Both return the drawn poster's temp file path; the caller's share sheet
   previews it inline and offers save / forward. The QR comes from the
   site's qr.png service (web URL); after the Mini Program is published,
   download the official 小程序码 from the MP console into
   assets/mp-code.png and point QR_URL at it instead. */

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
const TITLE_LADDER = [66, 58, 48];

/* QR source: the site's web-QR service today; swap for the local official
   小程序码 asset once the MP is published (see header note). */
function qrUrlFor(url) {
  return `https://kimi.read.wiki/api/mp/qr.png?url=${encodeURIComponent(url)}`;
}

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
   draw into the resized canvas (resizing resets the context state).
   spec: { label, title, quote?, lede?, ledeMaxLines?, url, qrCaption? } */
async function drawPoster(page, spec) {
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
     Composition (Zhaphar grammar): masthead → label → title (calm,
     capped at 2 lines) → optional quote with a vertical hairline (the
     protagonist on chapter posters) → a short muted lede → the fixed
     214px footer band. */
  const contentW = RIGHT - MARGIN;
  let size = TITLE_LADDER[TITLE_LADDER.length - 1];
  let titleLines = [];
  for (const s of TITLE_LADDER) {
    ctx.font = `600 ${s}px ${SERIF}`;
    titleLines = wrapText(ctx, spec.title, contentW, 2);
    size = s;
    if (titleLines.length <= 2) break;
  }
  const titleLH = Math.round(size * 1.23);
  const titleFirstBaseline = 300 + size;
  const titleEndY = titleFirstBaseline + (titleLines.length - 1) * titleLH;

  let quoteLines = [];
  if (spec.quote) {
    ctx.font = `600 30px ${SERIF}`;
    quoteLines = wrapText(ctx, spec.quote, contentW - 34, 2);
  }
  const quoteLH = 46;
  const quoteTop = titleEndY + 78;
  const quoteEndY = quoteLines.length
    ? quoteTop + (quoteLines.length - 1) * quoteLH
    : titleEndY;

  let ledeLines = [];
  if (spec.lede) {
    ctx.font = `400 26px ${SERIF}`;
    ledeLines = wrapText(ctx, spec.lede, contentW, spec.ledeMaxLines || 2);
  }
  const ledeLH = 40;
  const ledeTop = (quoteLines.length ? quoteEndY : titleEndY) + 56;
  const ledeEndY = ledeLines.length
    ? ledeTop + (ledeLines.length - 1) * ledeLH
    : quoteEndY;

  const contentBottom = ledeLines.length ? ledeEndY + 8 : quoteEndY;
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

  // label (chapter number · 第N章, or book stats)
  ctx.fillStyle = C.muted;
  ctx.font = `600 14px ${MONO}`;
  drawSpaced(ctx, spec.label || "", MARGIN, 236, 3);

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

  // the quote — vertical hairline (chapter posters only)
  if (quoteLines.length) {
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN + 0.5, quoteTop - 24);
    ctx.lineTo(MARGIN + 0.5, quoteEndY + 12);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = `600 30px ${SERIF}`;
    quoteLines.forEach((line, i) => {
      ctx.fillText(line, MARGIN + 34, quoteTop + i * quoteLH);
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
      img.src = qrUrlFor(spec.url);
    });
    const qrSize = 132;
    ctx.drawImage(img, RIGHT - qrSize, fy + 41, qrSize, qrSize);
    ctx.fillStyle = C.muted;
    ctx.font = `500 15px ${SERIF}`;
    const cap = spec.qrCaption || "扫码读全文";
    const capW = ctx.measureText(cap).width;
    ctx.fillText(cap, RIGHT - qrSize + (qrSize - capW) / 2, fy + 41 + qrSize + 28);
  } catch (e) {
    /* no QR — the poster still stands (footer text carries the title) */
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

/** Chapter poster (read page share sheet). */
export function makeChapterPoster(page, info) {
  return drawPoster(page, {
    label: info.number,
    title: info.title,
    quote: info.kicker || "",
    lede: info.lede || "",
    ledeMaxLines: 2,
    url: info.url,
    qrCaption: "扫码读全文",
  });
}

/** Whole-book poster (book page share sheet). */
export function makeBookPoster(page, info) {
  return drawPoster(page, {
    label: `全 ${info.chapters} 章 · 约 ${info.minutes} 分钟`,
    title: info.coverTitle || info.title,
    quote: "",
    lede: info.lede || "",
    ledeMaxLines: 3,
    url: info.url,
    qrCaption: info.qrCaption || "扫码读全文",
  });
}
