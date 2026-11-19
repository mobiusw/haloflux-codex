# 0.1.0-preview.2

- 活动记录按调用原地更新。查看旧记录时保持阅读位置，支持一键回到最新；批量调用可展开查看已识别的工具和命令。
- 光环下方使用六四分栏汇总最近活动、任务状态和可折叠统计。技能记录保留绿色和明确前缀。
- 保留聊天选择并降低单个日志异常对会话列表的影响。确认同一 Git 提交已重试成功时，清除对应待处理项并保留失败历史。
- 中英文 README 使用新版看板的合成会话截图，展示状态栏、技能记录和批量明细。

解压 `haloflux-codex-v0.1.0-preview.2.zip` 后，Windows 可双击 `start.cmd`，也可直接运行 `node cli.cjs --open`。发行页面附带 `SHA256SUMS.txt` 供校验。

# 0.1.0-preview.1

首个独立 Codex 预览发行版。

- 只读解析本机 Codex 会话日志，支持会话选择、消息与活动筛选、暂停及折叠统计。
- HALOFLUX 半圆光环、运镜、真实活动面板、动作对象、结果摘要及本轮失败提示。
- 通用 Node.js 启动入口、Windows 双击启动、自定义端口和 Codex 主目录。
- 无第三方运行依赖；包含合成事件测试、本地 HTTP 集成测试和跨平台 CI 配置。
- 已知边界：部分命令和 skill 证据不能识别；不接入模型训练指标、编辑器单元格事件或 Codex 桌面背景。

下载 ZIP 后解压。安装 Node.js 22+，Windows 双击 `start.cmd`；其他平台运行 `node cli.cjs --open`。无须 `npm install`。

修改自 HALOFLUX by Ryder191 (RYDER CODE / Ms MAIKEBAIs CAT)：https://github.com/Ryder191/haloflux

引擎适配来源：https://github.com/Ke-wood/dsh-haloflux

仅限非商业使用。完整功能、数据口径和限制见 README；完整许可见 LICENSE 与 NOTICE。
