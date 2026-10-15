# Custom Kit 实施记录

更新日期：2026-10-14。

状态：P4–P6 首版已完成开发验收，真实上传、Vision 与参考图生成已验证。上传图片两层审核已按当前尺度校准（非露骨机娘放行，明确色情与未成年人性化内容拦截），`dev:hallowed-raven-873` 的 `CUSTOM_KIT_SAFESEARCH_MODE` 为 `enforce`。该部署已配置 Vision profile、本地上传 CORS，并设 `CUSTOM_KIT_ENABLED=true`，可在开发环境使用。生产部署 `prod:resolute-giraffe-272` 已于 2026-10-14 配齐配置并开放，见下方生产记录。未配置该开关的部署默认关闭。首页在开关打开时以「上传自己的模型」为主说明，开关关闭时仍只介绍目录机型。

## 已实现范围

- 创建第二步选择 Official Kit 或 Custom Kit。首版只接收一张参考图，未增加多图或纯文本创建入口。
- 独立 `customKits`、不可变 `customKitVersions`、扫描记录和上传票据。上传不会创建 `baseModels` 或自动关联 IP。
- 上传签名 URL 有效 5 分钟；服务端读取并完整解码图像，验证真实格式、字节数、静态单帧和尺寸，清除元数据，转成 WebP 存到另一个不可覆写的私有对象。支持 PNG / JPG / WebP，最多 8 MB，每边 256–4096 px，总像素不超过 16,777,216。
- 复用媒体资产图、私有存储配额、签名读取和删除生命周期。用户可移除保存的 Kit 与参考；已有作品保留，删除参考后不可继续基于该参考渲染。
- 一次普通 Gemini Vision 请求返回适用性、可见部件、稳定 ID 与未知区域。服务端验证 Schema，并绑定用户、参考版本、扫描版本和模型配置。
- 普通动物、人物和无关主体不能进入主生成；不清晰或不确定主体要求更好的参考；原创、未知 IP、四足或兽形机器人不要求目录匹配。
- 扫描结果保留原始观察；用户纠正和明确的部件修改写成新的有效 Kit 版本。新增部件标为用户提案，不能冒充原图观察。
- Custom Kit 接入现有 Resolver → Palette → Specification → Render。配色和油漆产品继续分离，Specification 验证部件引用，Paint Plan 使用批准分配后的部件名称。
- 默认参考视角 HD Render；其他模式在服务端拒绝、界面隐藏。必需参考无法读取、校验和改变或图像路线不兼容时失败并走已有退款/恢复机制。
- Library、生成记录和公开作品保留 Custom 来源。公开返回值只带名称与版本，不公开原始参考、扫描、纠正或私有结构修改；公开 Custom 作品的创建入口要求使用自己的参考。
- 每次模型调用继续经过现有 Waffo 文本安全筛查。上传图片另有独立的两层审核，见下一节。

## 上传图片内容审核（kit-scan.v2）

两层审核，都在用户点击 Scan 之后、任何生成之前执行：

1. **Google Cloud Vision SafeSearch（第一层）。** 服务端把参考图缩到长边 1024 px 的 JPEG，经 `x-goog-api-key` 请求头调用 `images:annotate` 的 `SAFE_SEARCH_DETECTION`。阈值在 `convex/customKitSafeSearch.ts`：`adult` ≥ `LIKELY`，或 `adult` = `POSSIBLE` 且 `racy` = `VERY_LIKELY`，判为 adult-content；`medical` = `VERY_LIKELY` 且 `violence` ≥ `LIKELY` 判为 graphic-injury；单独的 `violence` 或单独的 `racy` 都不拦截（避免误伤机甲战斗、武器、战损，以及非露骨的机娘手办）。被拦截的图片不会再发给 Gemini。`adult`/`racy` 为 `UNKNOWN`、接口出错、超时或缺少 key 都按技术失败退款，不放行。五项判定和模式写入扫描的 `executionJson`，用于校准。
   - 环境变量：`GOOGLE_CLOUD_VISION_API_KEY`（必需，仅限 Cloud Vision API 的 API key；未配置时 `customKits:availability` 返回不可用）；`CUSTOM_KIT_SAFESEARCH_MODE`（可选，`enforce` 默认 / `monitor` 只记录 `wouldBlock` 不拦截）。
   - 费用：每月前 1,000 次免费，之后每 1,000 次 $1.50。
2. **Gemini 扫描内的安全判定（第二层）。** 补充 SafeSearch 没有的类别（未成年人、仇恨符号、自伤），与结构识别是同一次调用。Schema 先给出 `contentSafety`（`allowed` / `blocked` + 类别：adult-content、minor-safety、graphic-injury、hateful-symbol、self-injury、other），再判定适用性和结构；服务端校验 `blocked` 必须是 `unsupported`、无部件、无未知区域，类别与结论一致。只有放行且 `supported` 的扫描才能确认并进入生成计划。

**审核尺度。** 允许非露骨的性感角色模型：成人比例的角色、机娘手办穿着暴露但有遮挡的服装（泳装式或紧身装甲、乳沟、曲线身材）属于正常商业模型。adult-content 只拦截明确色情内容（可见私密部位、亲密行为、以私密展示为明确焦点的姿势和构图）；拿不准时放行。minor-safety 保持从严：凭脸部、身体比例或语境判断为儿童或儿童外观的角色，只要以暴露服装、挑逗姿势或亲密构图呈现即拦截；拿不准是否未成年时拦截。

**生成意图。** 用户的风格描述、修改说明和提示词在每次文本、图片调用前都经过屏蔽词表和 Waffo 提示词审核。另外，Custom Kit 的规划规则（`customKitPlanningRules`）和渲染保留条款都规定：不得减少角色原有的服装、装甲遮挡，不得让角色比参考图更暴露或更挑逗；即使修改要求暗示了这一点，也视为未获批准。

- SafeSearch 拦截、模型判定 `blocked`，或 Gemini 自身返回 `content_filter` / refusal（`ProviderSafetyBlockError`），都按“内容被拦截”完成扫描：按显示费率收费、不退款；不再当作技术失败退款。
- 拦截后 Kit 状态变为 `blocked`，不能扫描、确认或渲染；私有参考立即交给存储生命周期删除。扫描记录只保存类别和固定说明（`safetyBlocked: true`），不保存模型对图片的描述。
- 同一账户 30 天内累计 3 次拦截，暂停新的上传和扫描。
- 提示词位于 `convex/` 目录，受 `contentBlocklistPolicy.test.ts` 约束，不能写入基础屏蔽词。
- 版本从 v1 升到 v2 后，旧扫描不能再用于新创作，开发环境已有的 Kit 需要重新扫描；历史作品不受影响。
- 局限：大语言模型审核不是专用分类器，边缘内容可能漏判或误判；它不能代替 CSAM 哈希比对。Gemini 在 HTTP 层直接拒绝（非 200）的情况仍按技术失败退款，真实返回形态需在开发环境用安全样本核实。

## 扫描费用和复用

当前扫描沿用已激活的 `generate-style-suggestion` 单次 Credits 费率（当前开发部署为 1 Credit），界面在点击前显示费用，与后续 Preview 总价分开。扫描技术失败、超时或无效输出全额退款；适用性为“不支持”或“需要更好参考”属于有效完成的扫描，按显示费率收费。本次开发验收使用这一规则，其他部署仍须明确配置后开放。

同一 Kit、参考校验和与版本、Vision 模型和模板版本的运行中 / 成功扫描复用，不重复扣费。技术失败可重新扫描并重新预扣，失败仍退款。切换 Style 和修改结构不自动重扫图片。生成输入键包含 Custom Kit 版本；旧版不能用于新创作，历史作品仍使用冻结快照。

## 开发环境配置

先确认目标是开发部署。复用已经验证的官方 Gemini 文本 Profile 创建独立 Vision capability Profile，不更改既有文本或图像路线：

```sh
npx convex run customKits:configure '{"textProfileId":"实际官方 Gemini Profile ID"}'
npx convex run customKitsNode:configureUploadCors '{"origins":["http://localhost:3001","http://localhost:3100"]}'
```

上传 CORS 是独立的 PUT 规则，保留现有 Library GET / HEAD 规则。线上只配置精确的 HTTPS 前端 origins，不用通配符。复用 `GEMINI_API_KEY_OFFCIAL` 和现有私有 R2 配置；新增的环境变量只有 `CUSTOM_KIT_ENABLED`。

确认具体模型支持图像 content parts 和 JSON Schema 后，才在开发验收目标开放开关。SDK / API 语法依据 [Gemini OpenAI 兼容官方文档](https://ai.google.dev/gemini-api/docs/openai)，文档能力不能替代真实样本验收。

## 生产环境开放记录（2026-10-14）

按用户授权开放 `prod:resolute-giraffe-272`：

- `CUSTOM_KIT_ENABLED=true`，`CUSTOM_KIT_SAFESEARCH_MODE=enforce`；现有 `CONTENT_SAFETY_MODE=enforce`。
- 从生产官方 Gemini 文本 Profile 创建独立 `custom-kit-vision` Profile（`mn79fs6anr4z5wefa98eye5htx8g8htt`），使用已通过开发验收的同型 `gemini-3.5-flash`、官方 OpenAI 兼容端点和 `GEMINI_API_KEY_OFFCIAL`。
- 生产已配置 `GOOGLE_CLOUD_VISION_API_KEY`，与已验收开发环境的 SafeSearch 密钥一致；密钥内容未打印或写入仓库。
- 私有 R2 只允许准确的生产 origins：`https://neotypelab.com` 和 `https://neotypelab-terminal.shendongloving123.workers.dev`。Library 下载规则为 GET / HEAD，Custom Kit 上传规则为 PUT。
- 当前扫描费率为 1 Credit，沿用已激活的 Style suggestion 费率；后续仍以界面显示的实际费率为准。

开放后生产 `customKits:availability` 返回 `enabled: true`、`scanCost: 1`。两个生产域名的首页均已显示上传自己的模型、Bring your model 步骤及对应 FAQ。两个 origins 的 PUT / GET / HEAD 预检均返回 204 且跨域头正确，非许可 origin 被拒绝。

本次复用下方已经完成的真实开发验收记录，没有追加付费扫描或图像生成。生产开关和配置核验通过不等于本次重新执行了生产付费生成。

需要暂停入口时，明确生产目标后执行：

```sh
npx convex env set CUSTOM_KIT_ENABLED false --deployment resolute-giraffe-272
```

## 验证与开发交付

本地：lint 无错误、442 项单元/集成测试、生产构建、19 项公开 E2E 通过；新增认证入口检查和登录 setup 共 2 项通过，覆盖来源切换、缺少输入提示与手机布局。后端已通过 `dev:hallowed-raven-873` 部署校验。覆盖跨用户访问、混合 Kit 来源、扫描幂等、技术失败退款、超时晚结果、版本变更、原始观察不可变、隐藏部件拒绝、图片真实解码、两种 Style 的共用管线和未开放模式。

用户批准本次测试净上限 40 Credits。使用专用开发测试账户，通过浏览器上传 8 张单图，实际扫描 8 次；复用扫描不重复扣费。4 条 Preview 任务均完成（1 条归一化失败后退款并恢复），没有新建重复图像任务或追加预算。账户余额 253 → 213，净消费恰好 40 Credits；8 次扫描共 8 Credits，4 个完成的 Preview 各 8 Credits。

| 单图样本 | 实际适用性结果 |
| --- | --- |
| 已有七色模型的彩色照片 | supported；保持 Custom 身份 |
| 带背包 fin-funnel 结构的官方目录线稿作为用户上传 | supported；不写成官方目录来源 |
| 无 IP 的原创方形机器人示意图 | supported |
| 四足兽形机器人示意图 | supported |
| 普通猫插画 | unsupported，未进入主生成 |
| 普通人物插画 | unsupported，未进入主生成 |
| 严重模糊机体 | needs-better-reference，未进入主生成 |
| 主机体清晰、角落有猫 | supported |

| 生成案例 | Run / Concept | 实际结果 |
| --- | --- | --- |
| 彩色照片 + Arctic Ops + 蓝白 | `th74f2v785w5gjdtaf5xkgdgfn8g59t1` / `jn78w3z9wjmcpwy5ge3t0bfshx8g5ajy` | Palette / Specification / Render 通过；原先红、绿、橙、紫、黄、粉未继续污染装甲，主体结构和参考姿态保持 |
| 同图 + 肩甲轻微加厚 | `th78ensgt7v8bakppqvx04ba158g5vza` / `jn75gwsa71nb2h6b2v547q4eqs8g5p4h` | 局部修改与分配契约通过；成图作定性检查，未测量厚度或承诺精确尺寸 |
| 背包 fin-funnel 展开 | `th7cwerdws85b3prwammmq3wg98g5axb` / `jn7dv14cdzq4px1bc8ks5wvswh8g5nbb` | 单张线稿形成涂装实物效果，背包板片形成更宽的展开扇面 |
| 原创机器人 + 已保存七色自定义 Style | `th7662rhdba12dkzw0p5431xwx8g51h2` / `jn77hr20whk778tnw1q1kd0cx98g550y` | 原创方形结构生成实物概念效果，红胸、橙/紫手臂、粉大腿、绿小腿、黄头甲与蓝背板均可见 |

自定义 Style 首次尝试中，旧描述的 “A clean matte finish.” 被文本归一化错误解释成局部 Finish，Resolver 按当前契约拒绝，8 Credits 全额退回。增加了不从装甲配色推断局部 Finish 的明确解析规则，保持真实局部规则的拒绝边界；同一个失败任务重新解析后完成，没有篡改旧 Style 或扫描结果。

验收使用真实 Gemini 与 Cloudflare 路线，并人工查看四张成图；本地替身测试没有被用作视觉效果证明。样本包含示意图与模型照片，本次结果不是所有照片、机型或结构修改的质量保证。未知背部连接仍属于未知，单图不提供 CAD / 实体装配验证，细小局部修改没有像素或几何量测保证。上传图片审核已在开发环境用两张机娘样本校准：SafeSearch 对两张都放行（racy LIKELY、adult UNLIKELY），放宽后的 Gemini 规则对每张各 3 次都放行并读出结构。Waffo 筛查仍只覆盖提示文本。

本机验收报告：`/tmp/neotypelab-custom-kit-live/report.json`；截图同目录。重复运行 opt-in 测试会复用已完成记录；不得删除该报告后再次执行付费测试。测试代码：`tests/e2e/customKitLiveFixtures.ts` 与 `authenticated.spec.ts` 中的 `CUSTOM_KIT_LIVE_QA=1` 路径。生产交付须在明确生产目标后，单独按既有发布流程执行。
