/* Share posters — Canvas 2D, Zhaphar poster grammar ported from the
   sister project (Zhaphar/website · lib/miniapp/posters.ts):
   900px wide × content-driven height, 96px margins, right edges aligned
   to 804, warm paper + hairlines (no outer frame), Tsanger serif +
   JetBrains-style mono, title on ONE line shrunk to fit (the site
   poster's rule — not a multi-line ladder), accent stop-dot,
   vertical-hairline quote, a fixed 214px footer band with a frame-less
   QR on the right. Accent (Kimi blue) appears exactly twice: the
   masthead dash and the stop-dot.
   Two entries:
   - makeChapterPoster — chapter share (read page): number label + title +
     kicker quote + lede (light paper grammar)
   - makeBookPoster — whole-book share (book page): DARK cover composition
     (rounded CoverVisual cover + tagline overlay + title + lede + 3-col
     stats), drawn by drawBookPoster below
   Both return the drawn poster's temp file path; the caller's share sheet
   previews it inline and offers save / forward. QR chain per level:
   primary is the site's 小程序码 endpoint (/api/mp/v1/qrcode — home code
   without slug, per-chapter with ?slug=...); chapter posters fall back to
   the chapter's WEB qr (qr.png, precise deep link), the book poster to
   the local official home code (assets/mp-code.jpg). */

const W = 900;
const MARGIN = 96;
const RIGHT = 804;
const FOOTER = 214;
/* Poster palettes follow the reader's CURRENT theme (light/dark), so a
   poster saved in dark mode looks native in dark chats too. */
const C = {
  bg: "#fafafa",
  ink: "#1a1a1a",
  ink2: "#3a3a3a",
  muted: "#6b6b6b",
  rule: "#c0bfba",
  accent: "#1783ff",
  soft: "rgba(58,58,58,0.34)",
};
const C_DARK = {
  bg: "#1a1a1a",
  ink: "#fafafa",
  ink2: "#b8b8b8",
  muted: "#8a8a8a",
  rule: "#3a3a3a",
  accent: "#5e9fff",
  soft: "rgba(239,232,220,0.22)",
};
const SERIF = '"TsangerJinKai02-W05","Songti SC","STSong",serif';
const MONO = '"SF Mono",Menlo,Consolas,monospace';
/* Title rule (mirrors the site poster): ONE line, shrink-to-fit. */
const TITLE_MAX = 66;
const TITLE_MIN = 30;

/* The local official home 小程序码 (MP console download): the book
   poster's QR, and every QR's fallback when a remote code fails. */
const MP_CODE = "/assets/mp-code.jpg";

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
async function drawPoster(page, spec, theme) {
  const P = theme === "dark" ? C_DARK : C;
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
     Composition (Zhaphar grammar): masthead → label → title (calm, one
     line, shrink-to-fit) → optional quote with a vertical hairline (the
     protagonist on chapter posters) → a short muted lede → the fixed
     214px footer band. */
  const contentW = RIGHT - MARGIN;
  // Canvas measures for real — no width-table guessing. Start at 66,
  // shrink until the whole title fits one line, floor 30 (the site
  // poster applies the same rule with its em-table estimate).
  let size = TITLE_MAX;
  ctx.font = `600 ${size}px ${SERIF}`;
  const titleText = String(spec.title || "").trim();
  const fullTitleWidth = ctx.measureText(titleText).width;
  if (fullTitleWidth > contentW) {
    size = Math.max(TITLE_MIN, Math.floor((size * contentW) / fullTitleWidth));
    ctx.font = `600 ${size}px ${SERIF}`;
  }
  const titleLines = [titleText];
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
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  // masthead — accent dash + spaced mono brand + serial, hairline
  ctx.fillStyle = P.accent;
  ctx.fillRect(MARGIN, 132, 42, 3);
  ctx.fillStyle = P.ink;
  ctx.font = `600 15px ${MONO}`;
  drawSpaced(ctx, "KIMI COOKBOOK", MARGIN + 66, 140, 4);
  ctx.fillStyle = P.muted;
  drawSpacedRight(ctx, "NO. 01", RIGHT, 140, 4);
  hairline(ctx, MARGIN, RIGHT, 180, P.soft);

  // label (chapter number · 第N章, or book stats)
  ctx.fillStyle = P.muted;
  ctx.font = `600 14px ${MONO}`;
  drawSpaced(ctx, spec.label || "", MARGIN, 236, 3);

  // title — calm: one line, shrunk to fit
  ctx.fillStyle = P.ink;
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
    ctx.fillStyle = P.accent;
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
    ctx.strokeStyle = P.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN + 0.5, quoteTop - 24);
    ctx.lineTo(MARGIN + 0.5, quoteEndY + 12);
    ctx.stroke();
    ctx.fillStyle = P.ink;
    ctx.font = `600 30px ${SERIF}`;
    quoteLines.forEach((line, i) => {
      ctx.fillText(line, MARGIN + 34, quoteTop + i * quoteLH);
    });
  }

  // lede — short, muted, metadata weight
  if (ledeLines.length) {
    ctx.fillStyle = P.ink2;
    ctx.font = `400 26px ${SERIF}`;
    ledeLines.forEach((line, i) => {
      ctx.fillText(line, MARGIN, ledeTop + i * ledeLH);
    });
  }

  // footer band — fixed 214px: hairline, brand + date left, QR right
  const fy = H - FOOTER;
  hairline(ctx, MARGIN, RIGHT, fy, P.rule);
  ctx.fillStyle = P.ink;
  ctx.font = `600 20px ${SERIF}`;
  ctx.fillText("Kimi · 从长文本到一套 agent 栈", MARGIN, fy + 78);
  ctx.fillStyle = P.muted;
  ctx.font = `600 13px ${MONO}`;
  drawSpaced(ctx, "kimi.read.wiki", MARGIN, fy + 116, 2);
  const today = new Date();
  const stamp = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  drawSpaced(ctx, stamp, MARGIN, fy + 152, 2);

  // QR chain: primary is the site's per-level 小程序码 (opens the MP).
  // Chapter posters fall back to the chapter's WEB qr (precise deep link);
  // the book poster to the local official home code. The caption follows
  // whichever code actually got drawn.
  const qrSize = 132;
  const drawQrImage = (src) =>
    new Promise((resolve, reject) => {
      const img = canvas.createImage();
      img.onload = () => {
        ctx.drawImage(img, RIGHT - qrSize, fy + 41, qrSize, qrSize);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  try {
    let usedFallback = !spec.qrSrc;
    try {
      await drawQrImage(spec.qrSrc || spec.qrFallback || MP_CODE);
    } catch (e) {
      if (!spec.qrFallback) throw e;
      await drawQrImage(spec.qrFallback);
      usedFallback = true;
    }
    const cap =
      usedFallback && spec.qrFallbackCaption
        ? spec.qrFallbackCaption
        : spec.qrCaption || "扫码打开小程序";
    ctx.fillStyle = P.muted;
    ctx.font = `500 15px ${SERIF}`;
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

/* ── book poster, in both themes: masthead → rounded CoverVisual cover
   with the tagline overlaid → eyebrow → title (+ accent stop) → lede →
   3-col stats with vertical hairlines → footer band with the home
   小程序码. The reference's static buttons are intentionally dropped —
   the QR is the call to action on a static poster. The cover art and its
   tagline stay dark in BOTH themes (the art is theme-stable); everything
   around them follows the palette. */
const D = {
  bg: "#0E0E13",
  ink: "#FAFAFA",
  brand: "#EFE8DC",
  muted: "#8A8A8A",
  border: "#3A3A3A",
  accent: "#1783FF",
  lede: "#B8B8B8",
  soft: "rgba(239,232,220,0.22)",
};

const D_LIGHT = {
  bg: "#FAFAFA",
  ink: "#1A1A1A",
  brand: "#1A1A1A",
  muted: "#6B6B6B",
  border: "#C0BFBA",
  accent: "#1783FF",
  lede: "#3A3A3A",
  soft: "rgba(58,58,58,0.34)",
};

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawBookPoster(page, spec, theme) {
  const Q = theme === "dark" ? D : D_LIGHT;
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

  /* ── pass 1 · layout ── */
  const contentW = RIGHT - MARGIN;
  const coverH = Math.round((contentW * 920) / 1308);
  const coverTop = 216;
  const coverBottom = coverTop + coverH;
  const eyebrowY = coverBottom + 100;

  let titleSize = 56;
  let titleLines = [];
  for (const s of [56, 48, 42]) {
    ctx.font = `600 ${s}px ${SERIF}`;
    titleLines = wrapText(ctx, spec.title, contentW, 2);
    titleSize = s;
    if (titleLines.length <= 2) break;
  }
  const titleLH = Math.round(titleSize * 1.3);
  const titleFirstBaseline = eyebrowY + 86;
  const titleEndY = titleFirstBaseline + (titleLines.length - 1) * titleLH;

  ctx.font = "400 25px " + SERIF;
  const ledeLines = wrapText(ctx, spec.lede, contentW, 3);
  const ledeLH = 42;
  const ledeTop = titleEndY + 56;
  const ledeEndY = ledeLines.length
    ? ledeTop + (ledeLines.length - 1) * ledeLH
    : titleEndY;

  const statsTop = ledeEndY + 56;
  const footerY = statsTop + 158;
  const H = footerY + FOOTER;

  /* ── pass 2 · draw (resizing resets state) ── */
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = Q.bg;
  ctx.fillRect(0, 0, W, H);

  // masthead — accent dash + spaced mono brand + serial, faint hairline
  ctx.fillStyle = Q.accent;
  ctx.fillRect(MARGIN, 128, 42, 3);
  ctx.fillStyle = Q.brand;
  ctx.font = `600 15px ${MONO}`;
  drawSpaced(ctx, "KIMI COOKBOOK", MARGIN + 66, 136, 4);
  ctx.fillStyle = Q.muted;
  drawSpacedRight(ctx, "NO. 01", RIGHT, 136, 4);
  hairline(ctx, MARGIN, RIGHT, 176, Q.soft);

  // cover — rounded clip over the rasterized CoverVisual moon scene
  try {
    const img = canvas.createImage();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = "/assets/cover.png";
    });
    ctx.save();
    roundRectPath(ctx, MARGIN, coverTop, contentW, coverH, 18);
    ctx.clip();
    ctx.drawImage(img, MARGIN, coverTop, contentW, coverH);
    ctx.restore();
  } catch (e) {
    /* cover missing — the text blocks still carry the poster */
  }

  // tagline — two-color overlay at the cover's bottom dark band; the art
  // is theme-stable dark, so these stay constant in BOTH themes
  ctx.font = `600 30px ${SERIF}`;
  const tag1 = "Think clearly. Build with ";
  const tag2 = "Kimi";
  const tag3 = ".";
  const tagW =
    ctx.measureText(tag1).width +
    ctx.measureText(tag2).width +
    ctx.measureText(tag3).width;
  let tagX = (W - tagW) / 2;
  const tagY = coverBottom - 48;
  ctx.fillStyle = "#EFE8DC";
  ctx.fillText(tag1, tagX, tagY);
  tagX += ctx.measureText(tag1).width;
  ctx.fillStyle = Q.accent;
  ctx.fillText(tag2, tagX, tagY);
  tagX += ctx.measureText(tag2).width;
  ctx.fillStyle = "#EFE8DC";
  ctx.fillText(tag3, tagX, tagY);

  // eyebrow
  ctx.fillStyle = D.muted;
  ctx.font = `600 14px ${MONO}`;
  drawSpaced(ctx, spec.eyebrow || "— 技术 · 实践", MARGIN, eyebrowY, 3);

  // title — capped at two lines, accent stop-dot when unclosed
  ctx.fillStyle = Q.ink;
  ctx.font = `600 ${titleSize}px ${SERIF}`;
  let lastWidth = 0;
  titleLines.forEach((line, i) => {
    const y = titleFirstBaseline + i * titleLH;
    ctx.fillText(line, MARGIN, y);
    if (i === titleLines.length - 1) lastWidth = ctx.measureText(line).width;
  });
  const renderedLast = titleLines[titleLines.length - 1] || "";
  if (!/[。!?…；，、：:;,.!?]$/.test(renderedLast.trim())) {
    ctx.fillStyle = Q.accent;
    ctx.beginPath();
    ctx.arc(
      Math.min(RIGHT - 16, MARGIN + lastWidth + 20),
      titleEndY - titleSize * 0.12,
      7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // lede — muted, up to three lines
  if (ledeLines.length) {
    ctx.fillStyle = Q.lede;
    ctx.font = `400 25px ${SERIF}`;
    ledeLines.forEach((line, i) => {
      ctx.fillText(line, MARGIN, ledeTop + i * ledeLH);
    });
  }

  // stats — hairline + three columns with vertical separators
  hairline(ctx, MARGIN, RIGHT, statsTop, Q.border);
  const colW = contentW / 3;
  const stats = [
    { label: "章节", value: String(spec.chapters), desc: `约 ${spec.minutes} 分钟` },
    { label: "更新", value: spec.updated || "", desc: "" },
    { label: "作者", value: spec.author || "", desc: "写代码,也写字" },
  ];
  stats.forEach((s, i) => {
    const x = MARGIN + i * colW + (i ? 32 : 0);
    if (i) {
      ctx.strokeStyle = Q.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN + i * colW + 0.5, statsTop + 30);
      ctx.lineTo(MARGIN + i * colW + 0.5, statsTop + 132);
      ctx.stroke();
    }
    ctx.fillStyle = Q.muted;
    ctx.font = `600 13px ${MONO}`;
    drawSpaced(ctx, s.label, x, statsTop + 54, 2);
    ctx.fillStyle = Q.ink;
    ctx.font = `600 26px ${SERIF}`;
    ctx.fillText(s.value, x, statsTop + 96);
    if (s.desc) {
      ctx.fillStyle = Q.muted;
      ctx.font = `400 15px ${SERIF}`;
      ctx.fillText(s.desc, x, statsTop + 128);
    }
  });

  // footer band — hairline, brand + url + date left, home 小程序码 right
  hairline(ctx, MARGIN, RIGHT, footerY, Q.border);
  ctx.fillStyle = Q.brand;
  ctx.font = `600 20px ${SERIF}`;
  ctx.fillText("Kimi · 从长文本到一套 agent 栈", MARGIN, footerY + 78);
  ctx.fillStyle = Q.muted;
  ctx.font = `600 13px ${MONO}`;
  drawSpaced(ctx, "kimi.read.wiki", MARGIN, footerY + 116, 2);
  const today = new Date();
  const stamp = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  drawSpaced(ctx, stamp, MARGIN, footerY + 152, 2);

  const qrSize = 132;
  const drawQrImage = (src) =>
    new Promise((resolve, reject) => {
      const img = canvas.createImage();
      img.onload = () => {
        ctx.drawImage(img, RIGHT - qrSize, footerY + 41, qrSize, qrSize);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  try {
    try {
      await drawQrImage(spec.qrSrc);
    } catch (e) {
      await drawQrImage(MP_CODE);
    }
    ctx.fillStyle = Q.muted;
    ctx.font = `500 15px ${SERIF}`;
    const cap = "扫码打开小程序";
    const capW = ctx.measureText(cap).width;
    ctx.fillText(cap, RIGHT - qrSize + (qrSize - capW) / 2, footerY + 41 + qrSize + 28);
  } catch (e) {
    /* no QR — the poster still stands */
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

/** Chapter poster (read page share sheet) — theme-aware. */
export function makeChapterPoster(page, info, theme) {
  return drawPoster(page, {
    label: info.number,
    title: info.title,
    quote: info.kicker || "",
    lede: info.lede || "",
    ledeMaxLines: 2,
    url: info.url,
    qrSrc: info.slug
      ? `https://kimi.read.wiki/api/mp/v1/qrcode?slug=${encodeURIComponent(info.slug)}`
      : "",
    // Fallback: the chapter's WEB qr — a precise deep link beats an
    // imprecise home 小程序码 when the endpoint is down.
    qrFallback: `https://kimi.read.wiki/api/mp/qr.png?url=${encodeURIComponent(info.url)}`,
    qrCaption: "扫码打开小程序",
    qrFallbackCaption: "扫码读全文",
  }, theme);
}

/** Whole-book poster (book page share sheet) — theme-aware. */
export function makeBookPoster(page, info, theme) {
  return drawBookPoster(page, {
    title: info.coverTitle || info.title,
    lede: info.lede || "",
    chapters: info.chapters,
    minutes: info.minutes,
    updated: info.updated,
    author: info.author,
    qrSrc: "https://kimi.read.wiki/api/mp/v1/qrcode",
  }, theme);
}
