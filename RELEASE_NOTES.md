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
