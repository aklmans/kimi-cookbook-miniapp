import {
  getBook,
  getChapter,
  markVisited,
  markFinished,
  isFinished,
  saveProgress,
  getProgress,
  prefetchChapter,
  explainError,
} from "../../utils/api";
import { copyText } from "../../utils/clipboard";
import { makeChapterPoster } from "../../utils/poster";
import { applyTheme, readerTagStyle, THEME_LABEL } from "../../utils/theme";

/* Resolved lazily per call — getApp() at module top level can precede
   App() registration. */
const app = () => getApp();

/* Fallback when the chapter payload hasn't loaded — the whole-book
   prompt (fetch-first, anti-improvisation). */
const AI_PROMPT_BOOK =
  "请阅读《Kimi · 从长文本到一套 agent 栈》—— Zhapar 写的一本讲透 Kimi 产品栈的书 (10 章, 中文): K3 与 K2.7-Code 模型、四模式、Agent 与 Agent Swarm、Deep Research、Kimi Code 与开放 API、五档会员的取舍。\n\n第一步: 先抓取这份全书 markdown 再开始 —— https://kimi.read.wiki/books/kimi/llms.md\n它是这本书的完整文本。如果抓取失败, 请直接告诉我「打不开链接」, 不要凭你对 Kimi 的了解编造本书内容; 我要的是这本书里写的判断, 不是印象里的 Kimi。\n\n然后按需为我总结要点、回答具体问题、做读书笔记。引用时请保留作者署名 (Zhapar) 和章节链接。书的网页版 (含评论): https://kimi.read.wiki/books/kimi";

Page({
  data: {
    theme: "light",
    themeLabel: "跟随系统",
    fontSize: 17,
    chapter: null,
    /** Chapter payload rendered at least once — drives the skeleton, which
        must survive the brief html flushes of theme/font re-bakes. */
    loaded: false,
    html: "",
    tagStyle: {},
    containerStyle: "",
    outline: [],
    references: [],
    prompts: [],
    error: "",
    barHidden: false,
    progress: 0,
    /** "" | "outline" | "footnote" */
    panel: "",
    /** Outline entry the reader is currently at (scroll-spy on sheet open). */
    activeOutlineId: "",
    /** Offer "back to the citation" after jumping to the references block. */
    showReturn: false,
    /** Completion moment: last chapter reached its end with every chapter
        finished — swap the endcard for the book-completion card. */
    bookDone: false,
    activeRef: null,
    showAiPrompt: false,
    aiPromptText: "",
  },

  onLoad(options) {
    const slug = options.slug;
    if (!slug) {
      this.setData({ error: "缺少章节参数" });
      return;
    }
    this.slug = slug;
    this.restored = false;
    this.setData({
      fontSize: app().globalData.fontSize,
      themeLabel: THEME_LABEL[app().globalData.themeMode],
    });
    this.applyThemeRefresh();
    this.loadChapter();
  },

  /** Single theme-refresh path — onLoad, manual toggle, and WeChat's
      onThemeChange all land here. The reader's content styles derive
      from the theme ALREADY APPLIED to the page (page.data.theme), never
      from a second resolution, so the page chrome and the article body
      can never disagree. */
  applyThemeRefresh() {
    applyTheme(this);
    this.applyReaderStyle();
  },

  onShareAppMessage() {
    const ch = this.data.chapter;
    return {
      title: ch ? `${ch.title} · Kimi Cookbook` : "Kimi Cookbook",
      path: `/pages/read/read?slug=${this.slug}`,
      imageUrl: "/assets/moon-tile.png",
    };
  },

  onShareTimeline() {
    const ch = this.data.chapter;
    return {
      title: ch ? `${ch.title} · Kimi Cookbook` : "Kimi Cookbook",
      query: `slug=${this.slug}`,
    };
  },

  onPageScroll(e) {
    // Immersive chrome: the bottom bar hides scrolling down, returns
    // scrolling up.
    const last = this.lastScrollTop || 0;
    const delta = e.scrollTop - last;
    if (Math.abs(delta) > 10) {
      const hide = delta > 0 && e.scrollTop > 160;
      if (hide !== this.data.barHidden) this.setData({ barHidden: hide });
    }
    this.lastScrollTop = e.scrollTop;

    // Top progress bar — cheap ratio against the scroll length cached by
    // the throttled saver below (no async query on the scroll hot path).
    if (this.scrollMax > 0) {
      const p = Math.min(1, e.scrollTop / this.scrollMax);
      if (Math.abs(p - this.data.progress) > 0.003) this.setData({ progress: p });
    }

    if (!this.restored) return;
    if (this.scrollTimer) return;
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      this.saveProgressRatio();
    }, 400);
  },

  /** Page scroll metrics, measured on demand: the ratio representation
      survives font-size changes and late-loading images, which absolute
      scrollTop values do not. */
  measureScroll() {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .select(".page")
        .boundingClientRect()
        .selectViewport()
        .scrollOffset()
        .exec((res) => {
          const rect = res && res[0];
          const offset = res && res[1];
          if (!rect || !offset) return resolve(null);
          const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          resolve({ pageH: rect.height, scrollTop: offset.scrollTop, winH: info.windowHeight });
        });
    });
  },

  async saveProgressRatio() {
    const m = await this.measureScroll();
    if (!m) return;
    const max = m.pageH - m.winH;
    // Refresh the progress bar's denominator too — lazy-loaded images grow
    // the page while reading, so the length measured at load time goes stale.
    this.scrollMax = max;
    saveProgress(this.slug, max > 0 ? Math.min(1, m.scrollTop / max) : 0);
  },

  loadChapter() {
    this.setData({ error: "" });
    getChapter(this.slug)
      .then((chapter) => {
        markVisited(this.slug);
        this.setData({
          chapter,
          loaded: true,
          html: chapter.html,
          outline: chapter.outline || [],
          references: chapter.references || [],
          prompts: chapter.prompts || [],
        });
        wx.setNavigationBarTitle({ title: chapter.title.split(" · ")[0] });
        this.restoreScroll();
        if (chapter.next) prefetchChapter(chapter.next.slug);
      })
      .catch((err) => this.setData({ error: explainError(err) }));
  },

  /** Reaching the endcard counts as finishing the chapter — the honest
      counterpart to markVisited-on-load. On the LAST chapter it also
      checks for the completion moment: every chapter finished. */
  onReachBottom() {
    if (!this.data.loaded) return;
    markFinished(this.slug);
    const ch = this.data.chapter;
    if (!ch || ch.next || this.data.bookDone) return;
    getBook()
      .then((book) => {
        const all = book.chapters || [];
        if (all.length && all.every((c) => isFinished(c.slug))) {
          this.setData({ bookDone: true });
        }
      })
      .catch(() => {});
  },

  copyBookLink() {
    copyText("https://kimi.read.wiki/books/kimi", "链接已复制");
  },

  /** The whole-book AI prompt (fetch-first, anti-improvisation) — the
      same text the share sheet offers while a chapter is still loading. */
  shareBookToAI() {
    copyText(AI_PROMPT_BOOK, "已复制,粘贴给 AI 即可");
  },

  restoreScroll() {
    const progress = getProgress(this.slug);
    wx.nextTick(() => {
      setTimeout(async () => {
        if (progress && typeof progress.ratio === "number") {
          const m = await this.measureScroll();
          if (m) {
            this.scrollMax = m.pageH - m.winH;
            const target = Math.round(progress.ratio * this.scrollMax);
            if (target > 120) wx.pageScrollTo({ scrollTop: target, duration: 0 });
          }
        } else if (progress && progress.scrollTop > 120) {
          /* Legacy absolute entry from before ratio-based progress. */
          wx.pageScrollTo({ scrollTop: progress.scrollTop, duration: 0 });
        }
        // Gate saving until the restored position (or the top) has been
        // applied, so onPageScroll doesn't immediately overwrite it.
        this.restored = true;
      }, 350);
    });
  },

  applyReaderStyle() {
    const theme = this.data.theme || app().resolveTheme();
    const base = this.data.fontSize;
    this.setData({
      tagStyle: readerTagStyle(theme, base),
      containerStyle: `font-size:${base}px;line-height:1.8;color:${theme === "dark" ? "#fafafa" : "#1a1a1a"};max-width:680px;margin:0 auto;`,
    });
    this.flushContent();
  },

  /* mp-html only re-parses when `content` changes — a tagStyle update
     alone leaves the already-baked node styles stale (the article would
     keep the old theme's colors). Flush the content so the new styles get
     baked in, and carry the scroll RATIO across the re-render: the flush
     briefly collapses the page height (clamping scrollTop), and a font
     toggle changes every offset, so only a ratio lands the reader back
     where they were. Saving is gated off until the restore lands. */
  async flushContent() {
    const html = this.data.html;
    if (!html) return;
    const m = await this.measureScroll();
    const max = m ? m.pageH - m.winH : 0;
    const ratio = m && max > 0 ? m.scrollTop / max : null;
    this.restored = false;
    this.setData({ html: "" });
    wx.nextTick(() => {
      this.setData({ html });
      setTimeout(async () => {
        if (ratio != null) {
          const after = await this.measureScroll();
          if (after) {
            this.scrollMax = after.pageH - after.winH;
            wx.pageScrollTo({
              scrollTop: Math.round(ratio * (after.pageH - after.winH)),
              duration: 0,
            });
          }
        }
        this.restored = true;
      }, 300);
    });
  },

  toggleFont() {
    const size = app().cycleFontSize();
    wx.vibrateShort({ type: "light" });
    this.setData({ fontSize: size });
    this.applyReaderStyle();
  },

  toggleTheme() {
    app().cycleTheme();
    wx.vibrateShort({ type: "light" });
    this.setData({ themeLabel: THEME_LABEL[app().globalData.themeMode] });
    this.applyThemeRefresh();
  },

  openShare() {
    this.setData({ panel: "share" });
  },

  async makePoster() {
    this.setData({ panel: "" });
    const ch = this.data.chapter;
    if (!ch) return;
    wx.showLoading({ title: "正在画海报", mask: true });
    try {
      let lede = "";
      try {
        const book = await getBook();
        const row = (book.chapters || []).find((c) => c.slug === this.slug);
        lede = (row && row.lede) || "";
      } catch (e) {
        /* lede is optional */
      }
      const ord = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][
        Number(ch.number) - 1
      ];
      await makeChapterPoster(this, {
        number: `${ch.number} · 第${ord}章`,
        title: ch.title,
        kicker: ch.kicker || "",
        lede,
        url: `https://kimi.read.wiki/books/kimi/${this.slug}`,
      });
    } catch (e) {
      wx.showToast({ title: "海报生成失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  shareToAI() {
    this.buildAiPrompt().then((prompt) => {
      this.setData({ showAiPrompt: true, aiPromptText: prompt });
    });
  },

  /** Chapter-scoped prompt: exact chapter identity + one-line abstract +
      its own per-chapter markdown endpoint (focused fetch), with the
      whole-book markdown as the fallback context. */
  async buildAiPrompt() {
    const ch = this.data.chapter;
    if (!ch) return AI_PROMPT_BOOK;
    const base = "https://kimi.read.wiki";
    const chapterMd = `${base}/books/kimi/${this.slug}/llms.md`;
    let lede = "";
    try {
      const book = await getBook();
      const row = (book.chapters || []).find((c) => c.slug === this.slug);
      lede = (row && row.lede) || "";
    } catch (e) {
      /* lede is optional */
    }
    return (
      `请阅读《Kimi · 从长文本到一套 agent 栈》第 ${ch.number} 章「${ch.title}」—— Zhapar 写的这本书讲透 Kimi 产品栈 (10 章, 中文)。` +
      (lede ? `这一章: ${lede}\n\n` : "\n\n") +
      `第一步: 先抓取本章的完整 markdown 再开始 —— ${chapterMd}\n` +
      `抓取失败就直接告诉我「打不开链接」, 不要凭你对 Kimi 的了解编造; 我要的是这一章里写的判断, 不是印象里的 Kimi。\n\n` +
      `然后按需为我总结本章要点、回答具体问题、做笔记。需要更多上下文时说一声, 我把全书 markdown (${base}/books/kimi/llms.md) 也给你。引用请保留作者署名 (Zhapar) 和章节链接 (${base}/books/kimi/${this.slug})。`
    );
  },

  copyAiPrompt() {
    copyText(this.data.aiPromptText || AI_PROMPT_BOOK, "已复制,粘贴给 AI 即可");
  },

  closeAiPrompt() {
    this.setData({ showAiPrompt: false });
  },

  copyChapterLink() {
    this.setData({ panel: "" });
    copyText(`https://kimi.read.wiki/books/kimi/${this.slug}`, "链接已复制");
  },

  openPrev() {
    const prev = this.data.chapter && this.data.chapter.prev;
    if (prev) {
      wx.redirectTo({ url: `/pages/read/read?slug=${prev.slug}` });
    }
  },

  openNext() {
    const next = this.data.chapter && this.data.chapter.next;
    if (next) {
      wx.redirectTo({ url: `/pages/read/read?slug=${next.slug}` });
    }
  },

  goHome() {
    wx.reLaunch({ url: "/pages/book/book" });
  },

  openToc() {
    wx.navigateTo({ url: "/pages/toc/toc" });
  },

  /* ── in-chapter outline (mp-html anchors) ── */

  toggleOutline() {
    const opening = this.data.panel !== "outline";
    this.setData({ panel: opening ? "outline" : "" });
    if (opening) this.locateActiveSection();
  },

  /* Scroll-spy, measured at sheet-open time rather than on the scroll
     hot path: lazy-loaded images shift heading offsets while reading, so
     a fresh measurement right before the sheet shows is both cheaper and
     more accurate. The active entry is the last heading at/above the
     reading line (a little below the nav bar). */
  locateActiveSection() {
    const ids = this.data.outline.map((o) => o.id);
    if (!ids.length) return;
    const query = wx.createSelectorQuery().in(this.selectComponent("#mp-html"));
    for (const id of ids) query.select(`._root >>> #${id}`).boundingClientRect();
    query.exec((res) => {
      let active = ids[0];
      for (let i = 0; i < ids.length; i++) {
        if (res[i] && res[i].top <= 120) active = ids[i];
      }
      this.setData({ activeOutlineId: active });
    });
  },

  closePanel() {
    this.setData({ panel: "" });
  },

  jumpToSection(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ panel: "" });
    this.selectComponent("#mp-html")
      .navigateTo(id)
      .catch(() => {});
  },

  jumpToRefs() {
    this.setData({ panel: "" });
    /* The return target is the in-text marker's ANCHOR (fnref-<id>, site
       contract since 2026-07), not a recorded scroll offset — offsets get
       polluted by in-flight anchor-jump animations and lazy-load image
       growth, which is how the chip used to land back inside the refs
       block. The offset stays as the fallback for legacy cached HTML
       without fnref ids. */
    const ref = this.data.activeRef;
    this.returnAnchor = ref ? `fnref-${ref.id}` : "";
    this.returnTo = this.lastScrollTop || 0;
    this.selectComponent("#mp-html")
      .navigateTo("kc-refs")
      .then(() => {
        if (this.returnAnchor || this.returnTo > 160) {
          this.setData({ showReturn: true });
        }
      })
      .catch(() => {});
  },

  backToRef() {
    this.setData({ showReturn: false });
    const fallback = () =>
      wx.pageScrollTo({ scrollTop: this.returnTo || 0, duration: 300 });
    if (!this.returnAnchor) return fallback();
    this.selectComponent("#mp-html")
      .navigateTo(this.returnAnchor)
      .catch(fallback); // legacy cached chapter without fnref anchors
  },

  /** Links: footnote anchors open the reference sheet, other internal
      anchors scroll, external URLs get copied (a Mini Program can't
      open them). */
  onLinkTap(e) {
    const href = e.detail && e.detail.href;
    if (!href) return;
    if (href.startsWith("#kc-prompt-")) {
      const id = Number(href.slice("#kc-prompt-".length));
      const prompt = (this.data.prompts || []).find((p) => p.id === id);
      if (prompt) {
        const text = prompt.example
          ? `${prompt.template}\n\n—— 示例 ——\n\n${prompt.example}`
          : prompt.template;
        copyText(text, "提示词已复制");
      }
      return;
    }
    if (href.startsWith("#fn-")) {
      const id = Number(href.slice(4));
      const ref = (this.data.references || []).find((r) => r.id === id);
      if (ref) {
        this.setData({ panel: "footnote", activeRef: ref });
      }
      return;
    }
    if (href.startsWith("#")) {
      this.selectComponent("#mp-html")
        .navigateTo(href.slice(1))
        .catch(() => {});
      return;
    }
    copyText(href, "链接已复制");
  },

  copyRefLink() {
    const ref = this.data.activeRef;
    if (ref && ref.url) copyText(ref.url, "链接已复制");
  },

  onImgTap(e) {
    const src = e.detail && e.detail.src;
    if (src) {
      wx.previewImage({ urls: [src] });
    }
  },
});
