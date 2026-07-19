# Kimi Cookbook · 微信小程序

《Kimi · 从长文本到一套 agent 栈》的小程序阅读端。内容来自
[kimi-cookbook](https://github.com/aklmans/kimi-cookbook) 站点的
只读内容 API(`GET /api/mp/v1/*`),本工程是纯展示层:拉取 → 本地缓存 →
渲染,不含任何内容源。

## 结构

```
app.js / app.json / app.wxss   全局:主题(浅/深/跟随系统)、设计 token、
                               仓耳今楷 wx.loadFontFace、页面淡入
pages/book/                    首页 = 书页(刊头 NO.01、月砖封面卡、
                               继续阅读、已读 N/10、骨架屏)
pages/toc/                     目录(10 章,在读标记、已读置灰,骨架屏)
pages/read/                    阅读器(mp-html + Tsanger 排版)
                               · 章节内大纲(浮动 ≡ → 底部弹层,锚点跳转)
                               · 脚注弹层(点数字看引文,可复制链接)
                               · 章末引导卡(上一章/下一章/目录/分享)
                               · 沉浸式底部栏(下滑收起,毛玻璃)
                               · 字号两档、主题三态、位置记忆、预取下章
pages/about/                   关于本书(作者、授权、网页版)
components/mp-html/            富文本渲染器(vendored mp-html v2.5.2,
                               dist/mp-weixin,免 npm 构建)
utils/api.js                   内容 API 客户端(SWR 缓存 1h)+ 阅读状态 + 预取
utils/theme.js                 主题应用 + mp-html tag-style 排版表(Tsanger 栈)
assets/moon-tile.png           月之暗面站标(与网页 favicon 同构图)
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

- [ ] 首页:刊头 `KIMI COOKBOOK · NO. 01` + 月砖卡;读到章末两章后回来,CTA 变
      「继续 · <章名>」且出现「已读 N / 10」(按读完计)
- [ ] 目录:10 章,打开过未读完的标「在读」,读完的置灰;骨架屏先于内容出现
- [ ] 阅读:正文是仓耳今楷(衬线有笔锋,不是系统宋);代码块冷蓝面 + 蓝左条
- [ ] 阅读:右下 ≡ 弹大纲,点条目跳转;点脚注数字弹引文卡(可复制链接,
      「全部引用 ↓」落文末)
- [ ] 阅读:下滑底部栏自动收起,上滑回来;章末大卡切下一章(预取下应秒开)
- [ ] 阅读:A+ 字号变大且重排;主题三态循环(跟随系统/浅/深)
- [ ] 分享:书页/章节分享卡片带月砖图
- [ ] 深色全量走一遍(封面卡、代码面、弹层、底部栏)

## 内容契约(改动须知)

- 章节 HTML 由站点 `lib/mp-render.tsx` 生成:受限 HTML 子集,accent 内联,
  结构化排版由本工程 `utils/theme.js` 的 `readerTagStyle()` 计算。
- 章节载荷还带 `outline`(章内锚点)与 `references`(引文结构),大纲与
  脚注弹层依赖它们;旧缓存结构向后兼容。
- 外部链接在小程序里点不开,阅读页统一「复制链接」。
- 深色模式依赖 app.json `darkmode: true` —— 没有它,微信/开发者工具的深色
  环境会把主题 API 误报为 light,应用把浅色配色画到系统深色页上(不可读)。
  mp-html 只在 content 变化时重排,tagStyle 变更必须冲刷 content 才生效。
- 内联 SVG 图(3 张概念图)当前降级为灰框提示「见网页版」,栅格化待定。

## Backlog

分享海报(canvas 生成)、SVG 图 / 封面卡栅格化、`/api/mp/v1/version`
缓存失效精确化、P3 备案 / 正式 AppID / 提审。
