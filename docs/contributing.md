# 贡献 / 二开指南

微信原生小程序,无 npm、无构建、ES modules 直接用。看完本文即可开工;
视觉规范另见 [docs/design.md](./design.md),Agent 协作约定另见根目录
`AGENTS.md`。

## 环境

1. **起内容 API**:线上 `https://kimi.read.wiki` 已可用(默认指向它);
   本地联调则在 `kimi-cookbook` 仓库 `npm run build && PORT=3010 npm start`,
   再把 `app.js` 的 `globalData.baseUrl` 改成 `http://<局域网 IP>:3010`。
2. **导入工程**:微信开发者工具 → 导入本目录;AppID 先用「测试号」
   (`project.config.json` 里换成自己的)。
3. **关域名校验**:详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS
   版本以及 HTTPS 证书」。
4. **语法检查**(没有测试套件):改动的 `.js` 逐个过
   `node --input-type=module --check < file`;wxml/wxss 靠复查 +
   下方走查清单人工过。

## 项目结构速查

```
app.js / app.json / app.wxss   全局:主题、设计 token、仓耳今楷 loadFontFace
pages/book|toc|read|about      四个页面(read 是核心,约 500 行)
components/mp-html/            vendored mp-html v2.5.2(dist/mp-weixin)
utils/api.js                   内容 API 客户端(SWR 1h)+ 阅读状态(全本地)
utils/theme.js                 applyTheme + readerTagStyle 排版表
utils/poster.js                海报 canvas(章/书两级,官方小程序码)
utils/clipboard.js             copyText(隐私指引感知,别直接用 setClipboardData)
assets/                        cover.png(站点栅格化)、share-card.png(5:4)、
                               moon-tile.png、mp-code.jpg(官方小程序码)、
                               loading-img.png
docs/                          本文档、design.md、screenshots/(仅 GitHub,
                               packOptions.ignore 已排除出代码包)
```

## 内容契约(改动须知)

- 章节 HTML 由站点 `lib/mp-render.tsx` 生成:受限 HTML 子集,accent 内联,
  结构化排版由本工程 `utils/theme.js` 的 `readerTagStyle()` 计算。
- 章节载荷还带 `outline`(章内锚点)与 `references`(引文结构),大纲与
  脚注弹层依赖它们;旧缓存结构向后兼容。
- 文中脚注锚点 `fnref-N`(2026-07 起)供「返回引文处」chip 与引用列表
  ↩ 回跳精确落到文中上标;旧缓存无此锚点时 chip 回退到记录的滚动位置。
- 引用列表 `<li>` 刻意不带 id:mp-html 对 `#` 链接在 linktap 之外还会
  自动滚动(目标存在才滚),`#fn-N` 只是弹层触发标识被解析,绝不能有
  命中元素——否则点脚注会把页面强制甩到文末。
- 关于页内容来自 `/api/mp/v1/book` 的可选 `about` 字段:`lede` / `bookline`
  / `intro` / `meta[{label,value}]` / `sections[{no,title,paragraphs?|ways?,
  license?,contacts?}]` / `kicker`,纯文本不含 HTML,各数组数量不限,
  节标题不带句点(小程序自补 accent 点);字段缺失或 `sections` 为空时
  回退 `pages/about/about.js` 内置文案,服务端随时上下线,无需发版。
- 外部链接在小程序里点不开,阅读页统一「复制链接」。
- 海报二维码统一来自 `/api/mp/v1/qrcode`(无 slug = 首页码,
  `?slug=<章>` = 章级直达码,服务端 wxacode.getUnlimited 生成),
  加载失败回退本地官方码 `assets/mp-code.jpg`;阅读页兼容
  `options.scene` 作为 slug 来源(小程序码进入)。
- 深色模式依赖 app.json `darkmode: true` —— 没有它,系统深色环境会把主题
  API 误报为 light,浅色配色画到系统深色页上(不可读)。
  mp-html 只在 content 变化时重排,tagStyle 变更必须冲刷 content 才生效。
- 内联 SVG 图(3 张概念图)当前降级为灰框提示「见网页版」,栅格化待定。

## 走查清单(验收)

- [ ] 首页:刊头 `KIMI COOKBOOK · NO. 01` + 网页封面卡(月景 + 蓝卫星);读到
      章末两章后回来,CTA 变「继续 · <章名>」且出现「已读 N / 10」(按读完计)
- [ ] 目录:10 章,打开过未读完的标「在读」,读完的置灰;骨架屏先于内容出现
- [ ] 阅读:正文是仓耳今楷(衬线有笔锋,不是系统宋);代码块冷蓝面 + 蓝左条、
      全宽出血、长命令在词边界断行
- [ ] 阅读:右下 ≡ 弹大纲并高亮当前节,点条目跳转;点脚注数字弹引文卡
      (可复制链接,「全部引用 ↓」落文末,可一键返回引文处)
- [ ] 阅读:顶部进度条随滚动前进;下滑底部栏自动收起,上滑回来;章末大卡
      切下一章(预取下应秒开);十章读完,末章章末出现「全书完」大卡
- [ ] 阅读:底栏「Aa 设置」弹层:字号四档点选(重排后进度不丢)、主题三态
      三选一;弹层下滑即关;图片点开左右滑动;长按可选中复制代码;
      恢复上次位置后浮条提示、可点「回开头」
- [ ] 分享:书页标题「Think clearly. Build with Kimi.」,书页/章节分享卡片
      带月景图(share-card.png);首页「分享本书」弹层(书级海报)与章节分享
      弹层双 tab——海报内联预览、可保存到相册,AI tab 提示词框即拷;
      胶囊菜单含朋友圈入口
- [ ] 深色全量走一遍(封面卡、代码面、弹层、底部栏、链接与引用左边条浅蓝 accent)

## 资源再生成手册

- **首页封面** `assets/cover.png`:站点 dev server 起起来,用 Playwright 对
  书页 `.cover-card` 截图(按 1308×920 强制宽高),详见 git 历史
  `03c35ae` 的做法;品牌图变更时重出。
- **分享卡片图** `assets/share-card.png`:`sips -c 920 1150 assets/cover.png
  --out assets/share-card.png`(居中裁 5:4)。
- **小程序码** `assets/mp-code.jpg`:小程序后台下载官方码,缩到 300px
  (`sips -Z 300`),海报(canvas)与 README 共用。
- **界面截图** `docs/screenshots/`:真机/模拟器 PNG,828px 宽,
  只服务 GitHub README,不进代码包。

## 提交约定

- 提交信息:`<type>(mp): <中文一行>`,type ∈ feat / fix / chore / docs。
- 署名 trailer(协作者图标):

  ```
  Co-authored-by: Moonshot Agent <307365324+moonshot-agent@users.noreply.github.com>
  ```

- 站点仓库(kimi-cookbook)是另一套约定(npm test / lint / tsc / build
  gates),两边不要混。

## 发布史(存档,清单已闭环)

- **v1.0.0(首发)**:十章阅读、章内大纲/脚注、主题三态、字号四档、
  比例进度、目录在读/已读、章节分享(海报 + AI 提示词)、关于页接口驱动。
  上线要点(已完成):正式 AppID、request/downloadFile 双域名白名单
  (kimi.read.wiki)、隐私指引(剪贴板、相册仅写入)、ICP 备案。
- **v1.0.1**:首页书级海报放出(v1.0.0 冰封后解封),海报二维码换
  官方小程序码;代码包瘦身(docs 排除 + 码图 300px,图片资源 134K/200K)。
