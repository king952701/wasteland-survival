# 会话状态（active）

- **更新时间**：2026-10-10
- **项目**：末世废土（wasteland）· 根目录 `D:\moshi\wasteland`
- **阶段**：Concept（概念阶段刚落地，未过闸门）
- **配置**：Web/HTML5 Canvas · `rigor: standard` · `automation: autonomous`
- **代码根**：`src/` · **测试根**：`tests/`

## 与星海牧场的关系

完全独立的新项目，位于 `D:\moshi\wasteland`，与 `c:\Users\沈\Desktop\hunyuanji`（星海牧场）无任何耦合。

## 已完成的配方（按 standard 路径）

| # | 配方 | 产出 | 状态 |
| --- | --- | --- | --- |
| 1 | `setup-engine` | `project.yaml` + 19 个目录骨架 | COMPLETE |
| 2 | `brainstorm` | `design/gdd/game-concept.md` | COMPLETE |

`project.yaml` 未写 `modes.review_mode`（避免屏蔽 rigor 推导；standard → review_mode: lean）。

## 概念要点（详见 design/gdd/game-concept.md）

- 卖点：8000×8000 格无缝废土，白天搜刮经营、天黑前撤回据点，尸潮不等人
- 四条支柱：世界真的大 / 每个容器都值得按 E / 垂直空间是真的 / 压力来自时钟而非血量
- 硬规格：8000×8000 格、chunk 64×64、等距 2:1 瓦片 64×32px、45° 俯角、Z 轴分层（矿井 Z<0 / 地表 Z0 / 楼层 Z>0）
- 房屋随机生成、容器全部可按 E 搜索且状态持久化
- 8 大制造系统：采集、挖矿、制作（MVP）+ 钓鱼、炼金、附魔、武器、防具（二期）

## 最大风险（决定下一步）

- **R1** 6400 万格 chunk 流式生成的内存与卡顿 → 支柱「世界真的大」
- **R2** 45° 视角下建筑/角色深度排序 → 观感直接崩

## 下一步（未执行，等交接）

`prototype`：最小可运行原型，只验证 R1 + R2（chunk 流式生成与 45° 深度排序）。

## 尚未产出（standard 阶段后续）

`prototype` 原型 + REPORT.md、`art-bible`、`map-systems`（systems-index）、`design-system` × N、架构 ADR、Epic/Story、UX 规格。
