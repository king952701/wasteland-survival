# 会话状态（active）

- **更新时间**：2026-10-10
- **项目**：末世废土（wasteland）· 根目录 `D:\moshi\wasteland`
- **配置**：Web/HTML5 Canvas · `rigor: standard` · `automation: autonomous`
- **代码根**：`src/` · **测试根**：`tests/`
- **仓库**：`github.com/king952701/wasteland-survival`（workflow「构建末世废土 APK」）

## 已交付

| 端 | 位置 | 状态 |
| --- | --- | --- |
| PC | `D:\moshi\wasteland\index.html`（双击打开） | 已跑通并截图 |
| 安卓 | 桌面「末世废土APK」/ `末世废土-debug.apk` 0.45MB | CI success，已校验包内资源 |

远端 commit `00e004c`，run `37966014128` conclusion=success。

## 代码结构

```
index.html            入口 + 全部 CSS（含触屏摇杆样式）
src/data.js           常量、确定性噪声、物品、配方、loot、敌人、词缀、鱼、矿脉
src/world.js          chunk 流式生成、房屋随机生成、容器、地下矿井、diff 持久化
src/game.js           玩家、背包、装备、制造、交互、昼夜、存档
src/ai.js             感染者生成/AI/战斗/尸潮
src/render.js         45° 等距投影、深度排序、多层房屋、地下、昼夜光照
src/ui.js             HUD、背包/制作/建造/附魔/帮助面板、触屏控件
src/main.js           输入、主循环、装配、?auto=1 自启动
android/              WebView 壳（包名 com.wasteland.survival，入口 assets/index.html）
tests/screenshot*.js  Playwright 截图验证脚本
```

## 关键设计决策

- **6400 万格不驻留内存**：世界由种子推演，只存玩家改动过的 diff（采集/挖掘的格子、已搜容器 id、建造物）
- **chunk 64×64 + 分帧生成**（每帧预算 5ms），视口半径 3，超出 (r+3)² 卸载
- **Z 轴**：地表 Z0、楼层 Z>0、矿井 Z-1..-3；渲染只画当前层，避免多层遮挡排序复杂度
- **出生点**：世界中心海拔隆起 + 全局搜索「陆地 + 附近有房屋」
- **昼夜**：昼 12 分 / 夜 8 分，夜间怪物上限 46（白天 14），每 70 秒一波尸潮

## 已验证（有截图证据）

- 45° 等距渲染、HUD、时间/昼夜、坐标、Z 层显示
- 出生在大陆且房屋旁，感染者正常生成与追击
- **按 E 搜索容器**：搜到废金属、布片并进入背包
- 制作面板（全部配方 + 材料满足状态）、背包面板（装备槽 + 物品 + 词缀区）

## 未验证（NOT ASSESSED，诚实标注）

- 地下矿井（Z<0）的下井、挖矿、竖井上下
- 钓鱼、炼金、附魔、武器/防具制作的实际操作流程
- 据点建造与尸潮防守的实际手感
- 长时间运行的内存与帧率（chunk 卸载策略只做了代码级设计）
- 安卓真机触摸操作（摇杆/按钮未在真机验证）

## 出包链路（与星海牧场一致）

`api.github.com` REST 推送（github.com 443 不通）→ Actions 编译 → 桌面 APK 目录。
空仓库需先用 Contents API 建 README 产生 initial commit，否则 `git/blobs` 返回 409。
token 无 `delete_repo` 权限，删仓库会 403。
