# Paloma 迁移 Wails v3 → Electron

## Context
Wails v3 在"灵动岛"窗口层的核心能力上全线受限：官方拖动在本机 WebView2 上失效、无逐像素点击穿透、事件/坐标语义混乱，每个窗口特性都要 Win32 手工兜底。老大拍板换 **Electron**——透明/穿透/跟手拖动/托盘全是数百万应用验证过的一等公民。同时决定：**Aora Bot 引擎不再引入**，参考其设计自研打磨手绘脸。

前端 React 组件（球体/状态条/面板/动画）几乎全量复用；Go 侧仅内存待办+模拟事件，用 TS 在主进程重写；Wails 版本先 git commit 留档（**需老大授权首次 commit，仅 commit 不 push**）。

## 关键收益（相对现状）
- **点击穿透**：球外透明区域不挡鼠标（`setIgnoreMouseEvents(forward)`），Wails 完全做不到
- **跟手拖动**：CSS `-webkit-app-region: drag` 系统级拖动，删除整个自研 useWindowDrag
- **坐标一致**：主进程 DIP 逻辑坐标 + `screen` 模块多显示器权威，DPI 混用问题根除

## 实施步骤

### 0. git 留档（需授权）
当前仓库零提交（全部 untracked）。首次 `git commit` 保存 Wails 版本全部现状（仅 commit，不 push）。

### 1. 工程脚手架
- 根 `package.json` 改为 Electron 工程：`electron`（最新稳定 33+）、`electron-vite`（主/preload/renderer 三段构建 + dev HMR）、React 19/TS 保留、pnpm
- 删除 Wails 产物：`*.go`、`go.mod/sum`、`frontend/bindings/`、`build/`、`Taskfile.yml`、`wails.json`（已在 git 留档）
- 删除 Aora：`frontend/src/components/AoraFace.tsx`、`frontend/src/types/aora-bot.d.ts`、`@aora-bot/element` 依赖、README 署名段
- `electron.vite.config.ts`：renderer 沿用 frontend/（Vite 配置迁移，去掉 wails 插件）

### 2. 主进程窗口层 `electron/main/window.ts`（对齐 ui_mode.go 逻辑，换 DIP 逻辑坐标）
- `BrowserWindow({ transparent, frame:false, resizable:false, alwaysOnTop, skipTaskbar, hasShadow:false })`
- 五形态尺寸：compact 144×104 / panel 420×570 / notification 350×112 / dock 140×320，`edgePadding 10`、`snapMargin 96`（物理值 ÷1.25）
- `applyMode(mode)`：当前窗口中心锚定 + `screen.getDisplayNearestPoint().workArea` 钳制 + `setBounds`，广播 `mode:changed`
- **吸附**：`win.on('moved')` debounce 250ms → 中心距工作区左右缘 ≤96 → dock 贴边 / 已 dock 则恢复 compact
- **穿透**：renderer 每帧（pointermove）`elementFromPoint` 判定是否命中交互元素 → IPC `set-passthrough` → 主进程 `setIgnoreMouseEvents(true/false, {forward:true})`

### 3. 数据层主进程重写 `electron/main/store.ts`
按 internal/ 领域模型 TS 重写：AgentEvent/Todo/Automation 内存存储、模拟事件定时器（7s 序列）、最近 30 条截断。IPC：`ipcMain.handle`（snapshot/triggerSimulation/start|stopSimulation/addTodo/completeTodo/togglePanel/setMode）+ `webContents.send('agent-event')`。

### 4. preload `electron/preload/index.ts`
`contextBridge.exposeInMainWorld('paloma', { snapshot, triggerSimulation, ..., onAgentEvent, onModeChanged, onSettled, setPassthrough })`

### 5. renderer 迁移（改动收敛在 5 个已知接触面）
- `types.ts`：Go 枚举改手写常量（AgentStatus/EventType/TodoStatus 等，自包含）
- `backend.ts`：`desktopBackend` 换 `window.paloma`；Backend 接口与预览实现原样保留
- `useWindowDrag.ts` **删除**；Mascot/EdgeDock 的 dragHandlers 换 CSS `-webkit-app-region: drag`（按钮 no-drag），styles.css 7 处 `--wails-draggable` 同步替换；轻点用 onClick
- `useDragSettle.ts`：订阅 `mode:changed`/`settled` IPC 事件
- `App.tsx`：形态切换改调 `window.paloma.togglePanel/setMode`；去 face 分支（只留手绘脸）；ActivityPanel 去掉脸型切换 UI
- Mascot/EdgeDock/ActivityPanel/styles.css 其余原样搬运

### 6. 托盘 `electron/main/tray.ts`
Tray + 菜单（显示/隐藏小球、退出）；关窗即隐藏到托盘。

### 7. 验证
- `pnpm typecheck` + `electron-vite build` 通过
- dev 启动手测：拖动跟手（系统级）、球外点击穿透、点击展开面板、Esc 收起、拖右缘吸附状态条、状态条点击展开、拖离恢复
- CUA 回归核心链路（点击/吸附静态形态）
- 更新 README（Electron 架构）、迁移记忆文件

## 交付边界
首期 dev 运行验证；electron-builder 打包（NSIS）留二期。Go 测试随 Wails 版本留档，TS 侧以手测+类型检查为验证基线。