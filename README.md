# Kimi Cookbook · 微信小程序

《Kimi · 从长文本到一套 agent 栈》的小程序阅读端。内容来自
[kimi-cookbook](https://github.com/aklmans/kimi-cookbook) 站点的
只读内容 API(`GET /api/mp/v1/*`),本工程是纯展示层:拉取 → 本地缓存 →
渲染,不含任何内容源。

## 结构

```
app.js / app.json / app.wxss   全局:主题(浅/深/跟随系统)、设计 token、
                               仓耳今楷 wx.loadFontFace、页面淡入
pages/book/                    首页 = 书页(刊头 NO.01、网页封面卡(CoverVisual
                               栅格化 + 标语文字层)、继续阅读、已读 N/10、骨架屏)
pages/toc/                     目录(10 章,在读标记、已读置灰,骨架屏)
pages/read/                    阅读器(mp-html + Tsanger 排版)
                               · 章节内大纲(浮动 ≡ → 底部弹层,锚点跳转,高亮当前节)
                               · 脚注弹层(点数字看引文,可复制链接,跳全部引用后可返回)
                               · 章末引导卡(上一章/下一章;目录/分享带框大按钮;
                                 全书读完换成完成卡)
                               · 分享弹层(朋友/AI 双 tab:海报内联预览可保存、
                                 提示词框即拷)
                               · 沉浸式底部栏(下滑收起,毛玻璃)+ 顶部进度条
                               · 阅读设置弹层(字号四档点选、主题三态三选一)、预取下章
                               · 按比例位置记忆(恢复后浮条可一键回开头)
                               · 弹层下滑关闭、图片多图滑动、长按选中复制(selectable=force)
                               · 代码块全宽出血、词边界断行(overflow-wrap)
pages/about/                   关于本书(数据驱动:book 载荷 about 字段,
                               内置文案兜底)
components/mp-html/            富文本渲染器(vendored mp-html v2.5.2,
                               dist/mp-weixin,免 npm 构建)
utils/api.js                   内容 API 客户端(SWR 缓存 1h)+ 阅读状态 + 预取
utils/poster.js                海报 canvas(章/书两级,二维码现用站点 qr.png;
                               发布后换本地官方小程序码)
utils/theme.js                 主题应用 + mp-html tag-style 排版表(Tsanger 栈)
assets/moon-tile.png           月之暗面站标(与网页 favicon 同构图,分享卡片用)
assets/cover.png               首页封面:站点 CoverVisual 月景栅格化
                               (dev server + Playwright 截图,品牌图变更时重出)
```

## 本地跑起来(验收)

1. **起内容 API**:线上 `https://kimi.read.wiki` 已可用(默认指向它);
   本地联调则在 `kimi-cookbook` 仓库 `npm run build && PORT=3010 npm start`,
   再把 `app.js` 的 `globalData.baseUrl` 改成 `http://<局域网 IP>:3010`。
2. **导入工程**:微信开发者工具 → 导入本目录;AppID 先用「测试号」
   (`project.config.json` 里是 `touristappid` 占位,发布前换成正式 AppID)。
3. **关域名校验**:详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS
   版本以及 HTTPS 证书」(备案 + 白名单是 P3 的事,本地不用管)。

## 走查清单(P2 验收)

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
- [ ] 分享:书页/章节分享卡片带月砖图;章节分享弹层双 tab——朋友 tab 海报
      内联预览、可保存到相册,AI tab 提示词框即拷;胶囊菜单含朋友圈入口
      (正式发布后可见)
- [ ] 深色全量走一遍(封面卡、代码面、弹层、底部栏、链接与引用左边条浅蓝 accent)

## 发布(P3)

上线前逐项核对:

- [ ] **正式 AppID**:`project.config.json` 的 `touristappid` 换成正式 AppID
- [ ] **服务器域名**(小程序后台 → 开发管理 → 服务器域名):
      `request` 合法域名和 `downloadFile` 合法域名都加
      `https://kimi.read.wiki`(API、仓耳今楷字体、海报二维码都走它)
- [ ] **用户隐私保护指引**:声明「剪贴板」(复制链接/提示词)和
      「相册(仅写入)」(保存海报)
- [ ] **ICP 备案**:提审前提,以后台状态为准
- [ ] **站点契约已部署**:脚注交互(fnref/去 id/↩)不部署也能跑,
      但建议先发站点
- [ ] **发布后换小程序码**:小程序后台下载官方小程序码存为
      `assets/mp-code.png`,`utils/poster.js` 的 `qrUrlFor` 改指本地码
      (海报二维码从「扫码读网页版」变成「扫码开小程序」)
- [ ] 体验版真机过一遍上方走查清单(浅/深各一遍)

**版本号**:`1.0.0`(首发)

**小程序简介**(替换旧的通用文案):

> 《Kimi · 从长文本到一套 agent 栈》阅读端 —— 十章讲透 Kimi 产品栈:
> K3 与模型、四种模式、Agent 与集群、Deep Research、Kimi Code 与
> 开放 API,以及五档会员的取舍。

短版备选:「一本讲透 Kimi 的书:从长文本到一套 agent 栈。十章全文免费阅读。」

**上传项目备注**(开发者可见):

> v1.0.0 首发:《Kimi · 从长文本到一套 agent 栈》阅读端。内容来自
> kimi.read.wiki 只读 API(/api/mp/v1/*),SWR 缓存 1h,已缓存章节
> 离线可读。功能:十章全文(仓耳今楷排版)、章内大纲/脚注弹层、
> 主题三态、字号四档、进度比例记忆、目录在读/已读、章末分享
> (海报 + AI 提示词)、关于页接口驱动。依赖:request/downloadFile
> 域名 kimi.read.wiki;隐私:剪贴板、相册(仅写入)。

**提审版本描述**(审核可见):

> 首个版本。自有图书《Kimi · 从长文本到一套 agent 栈》
> (CC BY-NC-ND 4.0)的阅读应用。请重点体验:章节阅读、目录、
> 分享海报保存、剪贴板复制。

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
- 深色模式依赖 app.json `darkmode: true` —— 没有它,微信/开发者工具的深色
  环境会把主题 API 误报为 light,应用把浅色配色画到系统深色页上(不可读)。
  mp-html 只在 content 变化时重排,tagStyle 变更必须冲刷 content 才生效。
- 内联 SVG 图(3 张概念图)当前降级为灰框提示「见网页版」,栅格化待定。

## Backlog

SVG 图 / 封面卡栅格化、`/api/mp/v1/version` 缓存失效精确化、mp-render
给 img 补宽高(预留高度防漂移)、首页书级海报(v1.0.1:代码已备并注释,
换官方小程序码后放出);发布见上方「发布(P3)」清单。
