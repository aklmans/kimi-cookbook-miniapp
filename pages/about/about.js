import { applyTheme } from "../../utils/theme";
import { copyText } from "../../utils/clipboard";
import { getBook } from "../../utils/api";

/* Bundled fallback about content — rendered until /api/mp/v1/book carries
   the `about` field (contract: docs/api-about.md), and whenever the field
   is absent (older caches, pre-deploy server). The site owns the live
   copy; keep this in rough sync but prefer the payload. */
const DEFAULT_ABOUT = {
  lede: "一本讲透 Kimi 的书,和一个写字的人。",
  bookline: "KIMI · 从长文本到一套 AGENT 栈 · ZHAPAR · 2026",
  intro:
    "很多人对 Kimi 的印象还停在「长文本」那一年 —— 一次吃几万字、中文写得稳。那是它的旧定位。到 K3,它长成一套对标 OpenAI / Anthropic 的 agent 栈: 四模式、做出成品的 Agent、上百子 agent 的 Swarm、Deep Research、跑在终端的 Kimi Code,和一套双兼容的 API。这本书给这套栈画张图。",
  meta: [
    { label: "读者", value: "已付费 Kimi · 用得浅" },
    { label: "方法", value: "判断 · 边界 · 取舍" },
    { label: "形态", value: "在线 · PDF · llms.md" },
    { label: "语言", value: "中文" },
    { label: "订阅", value: "RSS" },
    { label: "授权", value: "CC BY-NC-ND 4.0" },
  ],
  sections: [
    {
      no: "I",
      title: "为什么写这本书",
      paragraphs: [
        "产品页会告诉你 Kimi 能做什么,但很少告诉你这件功能值不值得花十分钟学。一份会员打开的入口越来越多: 聊天框、四种模式、Agent、Agent 集群、Deep Research、Kimi Code、开放平台 API。问题不再是「有没有功能」,而是「这件活该从哪一面开始」。",
        "这本书只解决一类判断: Kimi 的每一面对标前沿的哪一个、买哪档够用、什么活该交给它、什么时候该回 frontier。读完以后,你应该能去做一件事,或者放心不做一件事。",
      ],
    },
    {
      no: "II",
      title: "这本书写什么",
      paragraphs: [
        "十章,从全景到取舍: 先给整套栈画张图,再逐面讲清 —— K3、K2.7-Code 与 K2.6 三颗脑子怎么分工; Instant / Thinking / Agent / Agent Swarm 四个模式怎么挑; Agent 什么时候能直接做出成品; 大活该不该动用集群; Deep Research 什么活值得等; Kimi Code 与双兼容 API 怎么接进你的工具链。",
        "最后两章收束成判断: 五档会员摆开,说清订阅不含 API,什么活该回 Claude / GPT、什么活交给 DeepSeek; 再用一张速查表,把常见的活对到该用的那一面。厂商自评与独立实测,分开算账。",
      ],
    },
    {
      no: "III",
      title: "怎么读",
      ways: [
        {
          label: "在线读",
          text: "从引子开始,或者直接从目录跳到你正卡住的那一章。",
          action: { kind: "toc", label: "打开目录" },
        },
        {
          label: "PDF",
          text: "需要慢读、标注或留档时,用这本书的打印版。书页内提供下载。",
          action: {
            kind: "copy",
            label: "kimi.read.wiki/books/kimi",
            value: "https://kimi.read.wiki/books/kimi",
            toast: "链接已复制",
          },
        },
        {
          label: "llms.md",
          text: "这本书有 AI 可读 Markdown。交给自己的 agent,让它按章节摘读、追问、引用。",
          action: {
            kind: "copy",
            label: "/books/kimi/llms.md",
            value: "https://kimi.read.wiki/books/kimi/llms.md",
            toast: "链接已复制",
          },
        },
        {
          label: "RSS",
          text: "这里不追日更。只想知道下一章什么时候出现,订阅 feed 就够了。",
          action: {
            kind: "copy",
            label: "feed.xml",
            value: "https://kimi.read.wiki/feed.xml",
            toast: "链接已复制",
          },
        },
      ],
    },
    {
      no: "IV",
      title: "作者与边界",
      paragraphs: [
        "这本书由 Zhaphar 撰写与维护。作者写代码,也写字,长期关心的是工具怎样进入真实工作,而不是发布当天的漂亮话。这里默认站在付费用户一侧: 可以推荐,但要说清为什么; 可以喜欢一个产品,也必须写它的 trade-off。",
        "这里不做 affiliate 排序,不夹带课程软广,不为了新模型发布重写整本书。大改版会补边注,判断变了会开新章。读到哪一章想说点什么,网页版的章末都有评论区,也可以直接发邮件。",
      ],
      license:
        "本书内容遵循 CC BY-NC-ND 4.0: 允许免费阅读、AI 摘读、引用与转发,须保留作者署名 (Zhaphar) 与原文链接; 禁止商业再发布与衍生改写。",
      contacts: [
        {
          label: "Twitter / X",
          text: "@ak_zhaphar",
          value: "https://x.com/ak_zhaphar",
          toast: "链接已复制",
        },
        {
          label: "GitHub",
          text: "aklmans/kimi-cookbook",
          value: "https://github.com/aklmans/kimi-cookbook",
          toast: "链接已复制",
        },
        {
          label: "Email",
          text: "hi@zhaphar.com",
          value: "hi@zhaphar.com",
          toast: "邮箱已复制",
        },
      ],
    },
  ],
  kicker: "工具替你做事,替不了你判断",
};

Page({
  data: {
    theme: "light",
    about: DEFAULT_ABOUT,
  },

  onLoad() {
    applyTheme(this);
    // Payload wins when it carries a USABLE `about` (a stub without real
    // sections keeps the bundled fallback); the SWR onFresh also repaints
    // if a fresher book lands after first paint.
    const take = (book) => {
      const a = book && book.about;
      if (a && Array.isArray(a.sections) && a.sections.length) {
        this.setData({ about: a });
      }
    };
    getBook(take).then(take).catch(() => {});
  },

  onShow() {
    this.applyThemeRefresh();
  },

  applyThemeRefresh() {
    applyTheme(this);
  },

  onShareAppMessage() {
    return { title: "关于本书 · Kimi Cookbook", path: "/pages/about/about" };
  },

  onShareTimeline() {
    return { title: "关于本书 · Kimi Cookbook", query: "" };
  },

  openToc() {
    wx.navigateTo({ url: "/pages/toc/toc" });
  },

  copy(e) {
    const { text, toast } = e.currentTarget.dataset;
    copyText(text, toast || "已复制");
  },
});
