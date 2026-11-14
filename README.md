# Paloma

Paloma 是基于 **Wails v3.0.0、Go、React 19 与 TypeScript** 的桌面 Agent 伴侣。视觉采用 GrokBot 风格的圆润双眼小精灵，提供两套可切换的脸：自绘 SVG 双眼脸，以及由 [Aora Bot](https://github.com/sam70361/aora-bot) 引擎驱动的程序化表情脸。

当前首期用于验证桌面交互、模拟活动和内存待办，**尚未连接任何真实 Agent**。

## 首期范围

| 能力 | 当前状态 |
| --- | --- |
| 桌面精灵 | 无边框、透明、置顶窗口；默认紧凑，支持通知与展开面板 |
| 精灵交互 | 按住拖动窗口（JS SetPosition）、轻点展开；拖动倾斜、按压回弹、接地阴影 |
| 边缘状态条 | 小球拖到屏幕左/右缘松手自动吸附成竖条（Go 侧 Win32 判定，多屏权威）；点击展开面板 |
| 灵动小动作 | 随机眨眼、视线漫游、安静 45 秒打瞌睡（Zzz）、有动静惊醒、新事件蹦跳 |
| 表情脸 | 面板可切换：手绘脸（SVG + CSS）与 Aora 脸（44 种动画状态引擎） |
| 精灵换色 | 碳黑（默认）/ 经典蓝 / 明黄 / 薄荷，双脸即时生效 |
| 活动演示 | 以 ZCode / DSH 名称产生模拟事件，支持手动切换状态与可停止的自动演示 |
| 活动记录 | 仅保留本次运行最近 30 条，面板展示最近 5 条 |
| 待办 | 可添加、标记完成；只在内存中保存，退出后丢失 |
| Agent 扩展边界 | 已定义 Provider / Runtime / EventSource 接口与模拟实现 |
| 定时计划 | 只有模型、仓储及调度器接口，界面显示“尚未实现” |

真实 ZCode / DSH、Webhook 接收、SQLite 持久化、定时任务执行、Pi / Hermes 接入均未实现。通知目前是应用内气泡，没有接通系统通知；“等待确认”中的“模拟完成”不会批准或执行真实操作。

## 表情脸说明

两种脸在面板“活动 → 状态演示 → 脸型切换”中即时切换，也可用启动参数 `?face=aora` 指定默认脸。

| | 手绘脸 | Aora 脸 |
| --- | --- | --- |
| 实现 | 自绘 SVG 双眼 + CSS 动画 | `@aora-bot/element` Web Component（弹簧物理引擎） |
| 表情 | 6 种情绪 + 拖动用力眼 | 引擎 44 种状态（思考冒泡、确认感叹号等） |
| CPU | ≈0%（合成器动画） | ≈0.4% 单核（实测 31ms / 8s） |
| 包体 | 无额外依赖 | 主包 gzip 增量约 130 KB，节日主题按需分包 |

两款脸共用同一交互层：拖动倾斜、按压回弹、接地阴影、点击/拖动判定均一致。

**Powered by [Aora Bot](https://github.com/sam70361/aora-bot)** —— 依据 Aora Bot 许可协议，个人与不超过 3 人的团队可免费使用（含商用），需保留本署名。

## 使用方式

- **紧凑态**：启动时为 `144 × 104` 窗口，按住小精灵可拖动位置，轻点展开面板。
- **边缘状态条**：把小球拖到屏幕左/右边缘松手，会吸附成竖条状态岛（情绪点 + 活动数 + 待办数）；点击展开面板，按住拖离边缘恢复小球。吸附判定由 Go 侧 Win32 完成（多屏权威）。
- **通知态**：收起时收到事件，窗口扩为 `350 × 112`；普通消息约 5 秒后收起，需操作或失败消息保留，直到查看或手动关闭。点击气泡查看详情。
- **展开态**：`420 × 570`，包含“活动 / 待办 / 计划”。点击精灵、面板的收起按钮或按 `Esc` 收起；窗口顶部的退出按钮用于关闭应用。
- **自动模拟演示**：默认关闭。在“活动 → 状态演示”点击“自动演示”后约每 7 秒产生一条模拟事件，点击“停止演示”可关闭；关闭后仍可手动预览状态。停止演示不会清空已有活动，演示开关不会跨重启保存。
- **脸型与换色**：面板“状态演示”下有“手绘脸 / Aora 脸”切换和四个颜色圆点（碳黑 / 经典蓝 / 明黄 / 薄荷），即时生效；`?face=aora` 参数可指定默认脸。
- **灵动小动作**：安静待机约 45 秒后打瞌睡（Zzz），任何动静会惊醒；新事件到达时小球蹦一下。

## Windows 开发环境

| 工具 | 要求与依据 |
| --- | --- |
| Go | `go.mod` 要求 **1.26.0 或更新版本**；安装 Wails CLI 时也需满足其工具链要求 |
| Node.js | 建议 **22.12.0 或更新版本**；锁定的 Vite 8 及 React 插件声明 `^20.19.0 || >=22.12.0` |
| pnpm | 使用支持现有 `pnpm-lock.yaml` 的版本；下面固定为本机已安装的 **12.4.2**，项目未设置 `packageManager` 字段 |
| Wails CLI | **v3.0.0**，与 Go 依赖和 `@wailsio/runtime` 的 `3.0.0` 对齐 |
| Windows 运行环境 | Windows 10/11，安装 Microsoft Edge WebView2 Runtime |

`wails3 task` 内置任务执行器，不要求另外安装 `task` 命令。本机核实版本为 Go 1.27.1、Node 22.19.0、pnpm 12.4.2、Wails CLI v3.0.0。

以下命令使用 **Windows Git Bash**，工作目录为项目根目录。

### 1. 安装工具与项目依赖

```bash
cd M:/Maxon-Project/paloma

go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0
npm install --global pnpm@12.4.2

wails3 version
node --version
pnpm --version

go mod download
pnpm --dir frontend install --frozen-lockfile
```

已安装相应工具时可跳过工具安装。若找不到 `wails3`，将 `go env GOBIN` 的目录加入 `PATH`；若该值为空，则使用 `go env GOPATH` 下的 `bin` 目录。

仓库使用 pnpm 锁文件；根 `Taskfile.yml` 的 `PACKAGE_MANAGER` 默认却是 `npm`。后续先导出环境变量，让开发模式启动的子任务也使用 pnpm，不能只在外层 `dev` 任务传一个局部变量。

```bash
export PACKAGE_MANAGER=pnpm
```

`frontend/.npmrc` 设置了 `minimum-release-age=10080`（7 天）。若安装因发布年龄策略受阻，应先核对依赖版本与发布时间，不要直接关闭策略或更新锁文件。Taskfile 中的依赖安装任务实际执行 `pnpm install`，首次安装采用上面的 `--frozen-lockfile` 以核对现有锁文件。

### 2. 生成 bindings 并构建前端

在同一终端、项目根目录执行：

```bash
wails3 task common:generate:bindings
pnpm --dir frontend run build
```

- `common:generate:bindings` 先运行 `go mod tidy`，再执行 `wails3 generate bindings -f '{{.BUILD_FLAGS}}' -clean=true -ts -i`；未传 `BUILD_FLAGS` 时该值为空。生成目录是 `frontend/bindings/`，不要手工修改生成文件。
- 前端 `build` 脚本为 `tsc && vite build --mode production`，产物在 `frontend/dist/`。`main.go` 通过 `go:embed` 嵌入该目录，因此直接运行或编译 Go 程序前需先准备前端产物。
- `wails3 task common:build:frontend` 是 Taskfile 的组合入口，会按需安装依赖、生成 bindings 并构建前端；`DEV=true` 时改用 `build:dev`。

### 3. 启动开发模式

```bash
export PACKAGE_MANAGER=pnpm
wails3 dev -config ./build/config.yml -port 9245
```

这与根 Taskfile 的 `dev` 任务一致。`build/config.yml` 依次调用 `wails3 build DEV=true`、后台任务 `common:dev:frontend` 和启动任务 `run`，支持前后端开发时的更新。Vite 配置监听 `127.0.0.1:9245`，启动前需确保端口可用。

只预览浏览器界面时，可另开终端运行：

```bash
pnpm --dir frontend run dev
```

打开 `http://127.0.0.1:9245/?preview`。`?preview` 启用独立的前端内存模拟后端，不连接 Go 服务，也不能验证原生窗口、拖动或 WebView2 行为；刷新页面会重置数据。

### 4. 构建并启动 Windows 程序

```bash
export PACKAGE_MANAGER=pnpm
wails3 task windows:build
wails3 task windows:run
```

`windows:build` 按 `build/windows/Taskfile.yml` 安装/构建前端、生成 bindings、图标及 Windows 资源，再编译 Go；默认 `CGO_ENABLED=0`，未设置 `DEV=true` 时使用生产构建参数。可执行文件为 **`bin/paloma.exe`**。`windows:run` 只运行已有程序，不会先构建。

在 Windows 主机上，根任务 `wails3 task build` / `wails3 task run` 分别分派到上述任务，`wails3 build` 也会走项目的构建 Taskfile。这里的构建生成可执行文件；制作 NSIS / MSIX 安装包另走 `package` 任务并需要对应打包工具。

### 5. 基础检查

```bash
go test ./internal/...
pnpm --dir frontend exec tsc --noEmit
```

内部 Go 测试覆盖领域校验、模拟 Runtime / Source、事件总线和内存仓储。前端尚未配置独立测试脚本。

## 代码与界面配置

- `main.go`：Wails 应用、窗口和服务装配（frameless + 透明 + 禁用系统边框装饰）。
- `ui_mode.go`：窗口 UI 形态的唯一权威——compact/panel/notification/dock-left/dock-right 五种形态的尺寸、锚定、工作区钳制全部用 Win32 物理坐标（MoveWindow）完成，形态变更通过 `paloma:mode` 事件广播。对外绑定：`TogglePanel` / `SetNotificationMode` / `SetCompactMode`。
- `app_service.go`：快照、模拟事件、内存待办、Wails 事件桥接与窗口句柄缓存。
- `drag_notifier.go`：用窗口对象的 `OnWindowEvent` 监听 Windows 原生 `WindowDidMove`（**必须注册在窗口级而非 application 级，且必须在窗口创建之后**），停稳 250ms 后发 `paloma:window-settled` 结算信号。
- `settle_windows.go`：`SettleAfterDrag` 吸附判定（窗口中心距工作区边缘 ≤120 物理像素吸附状态条），几何动作委托 `applyMode`。
- `win32_window.go`：Win32 syscall（FindWindowW/GetWindowRect/MonitorFromPoint/MoveWindow 等，物理坐标、多屏权威）。
- `internal/`：领域模型、Agent 扩展接口、事件总线、内存仓储及预留接口。
- `frontend/src/`：React 界面与浏览器预览后端。前端**不调用任何窗口尺寸/位置 API 管理形态**（彻底规避逻辑/物理 DPI 混用），只在 `useWindowDrag` 中用 JS SetPosition 实现拖动跟手，其余形态切换全部走 Go 绑定。
- `frontend/src/hooks/useWindowDrag.ts`：JS 拖动（pointermove → SetPosition，逐次直接下发）与轻点/拖动区分。
- `frontend/src/hooks/useDragSettle.ts`：订阅 `paloma:window-settled` 兜底结算。
- `Taskfile.yml`、`build/Taskfile.yml`、`build/windows/Taskfile.yml`、`build/config.yml`：实际构建与开发入口。

`frontend/components.json` 已配置 `@react-bits` registry：`https://reactbits.dev/r/{name}.json`，**尚未安装 ReactBits 组件**。当前精灵与状态动效由项目自己的 SVG / CSS 实现。

事件流、接口边界与后续设计见 [架构说明](docs/architecture.md)。
