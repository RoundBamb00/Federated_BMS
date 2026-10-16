# Federated_BMS

24S 电池网页上位机。基于原 `Code/GUI.py`，使用 React + Vite + Web Serial，浏览器直接连接当前电脑的 USB 串口。原 Python 文件完整保留。

## 使用

```bash
npm ci --ignore-scripts
npm run dev
```

打开终端显示的本地地址。建议 Node.js 22.12+。生产构建：`npm run build`，产物为 `dist/`。

1. 在电脑上的 Chrome / Edge 打开 HTTPS 网站（本地开发可用 localhost）。如果在 Lovable 中预览，请在独立标签页打开预览 URL。
2. 关闭占用串口的 Python GUI 或其他工具，把 BMS 通过 USB 连接到当前电脑。
3. 在“连接设置”选择波特率（默认 115200）、帧长（40 或 46 字节），以及是否同帧头交替识别两块板。
4. 点击“连接设备”，在浏览器弹窗选择串口，再点击“开始采集”。
5. 充放电按钮发送原上位机的三字节命令。界面 MOS 状态来自回传数据，不把写入成功当成硬件执行确认。

网页不自动连接、自动采集或自动下发控制命令。不需要云数据库；电池数据只在当前浏览器内存中处理。日志最多保留最近 300 条，单条原始数据预览最多 256 字节；完整字节仍送入解析器。刷新清空当前会话。

## 保留的功能

- PACK 1 / PACK 2，各 12 个单体（C01–C24）；总压、SOC、电流、两路温度、最大/最小电压、压差、帧长、MOS 状态。
- 六个原始采集／充放电控制命令、中英文、波特率、同帧头交替识别、原始收发日志、清空参数／日志。
- 桌面双面板与手机单列布局。真实串口连接要求浏览器支持 Web Serial；手机主要用于查看界面，未提供远程监控。

## 与桌面版的有意差异

- 帧长显式选择。原程序依赖下一帧的位置猜 40/46 字节，容易把 USB 分包边界当成协议长度；网页按所选帧长连续解析，最后一帧不需要等待下一帧。
- 只有两组都收到总压时，才显示“24S 总电压”；平均 SOC 同样需要两组。避免把单组 12S 读数显示成整个 24S。单组数值仍正常显示。
- 每组超过 5 秒没有新数据标为“数据已过期”；断开后保留并标记“上次读数”。重连清空旧值和 PACK 交替计数。
- “退出软件”由关闭网页代替；浏览器自己的串口选择器代替端口枚举。

## 协议

沿用这份 GUI 的 **40/46 字节协议**，不是其他固件版本的 70 字节格式。多字节值为大端；电压单位 mV，电流有符号 int16 × 1.0 A，温度有符号 int8。46 字节含 15 个电压槽，但只展示前 12 个，与原程序相同。未擅自更改电流量程，需在硬件端确认。

| 字段 | 40 字节偏移 | 46 字节偏移 |
|---|---:|---:|
| 帧头 / ID | 0 / 1 | 0 / 1 |
| 电压槽 | 2–25（12个） | 2–31（15个，显示前12个） |
| 总压 uint16 | 26 | 32 |
| SOC uint16 | 28 | 34 |
| 电流 int16 | 30 | 36 |
| 温度1 int8 | 32 | 38 |
| DSG / CHG | 33 / 34 | 39 / 40 |
| MAX / MIN uint16 | 35 / 37 | 41 / 43 |
| 温度2 int8 | 39 | 45 |

AA01 按设置在 PACK1/2 间交替（关闭交替时为 PACK1）；AA02 始终为 PACK2；AA03–AA10 按奇偶识别，与原程序一致。交替识别无法检测丢帧导致的错位；设备能发送独立 ID 时应优先使用独立 ID。

| 操作 | 字节 |
|---|---|
| 开始 / 停止采集 | `01 02 55` / `01 03 55` |
| 打开 / 关闭放电 | `01 04 55` / `01 05 55` |
| 打开 / 关闭充电 | `01 06 55` / `01 07 55` |

该 GUI 协议没有校验和或命令确认；错误帧长、丢失字节、噪声伪帧头无法可靠识别。网页不是硬件保护策略的替代品。

## 验证

```bash
npm test
npm run build
npm run test:browser
npm audit
```

浏览器测试使用已安装的 Google Chrome（Playwright `channel: chrome`），不自动下载浏览器。测试通过假串口验证数据流、六条命令、重连、错误状态和响应式布局。`tests/source-parity.json` 来自原 Python 解码器，逐字段对照网页实现。

**自动测试未连接真实 BMS，不代表硬件通信、量程或 MOS 动作已验证。** 测试截图中的读数是测试夹具，不是实际测量。报告在 `docs/web-factory/`。

## GitHub 与 Lovable

源仓库：https://github.com/RoundBamb00/Federated_BMS

Lovable 官方不支持直接导入已有 GitHub 仓库。当前流程是先验证并推送这里的网页源码，再把相同源码交给 Lovable 创建项目。源码复制不等于 GitHub 双向同步；双向同步需要在 Lovable 项目的 Git 设置中配置其管理的仓库。不要删除或覆盖现有源仓库来绕过这个限制。

官方文档：https://docs.lovable.dev/integrations/github

Lovable 编辑器：https://lovable.dev/projects/6133d5d1-f4d4-4cbb-b261-9b3b14a11557

Lovable 预览：https://id-preview--6133d5d1-f4d4-4cbb-b261-9b3b14a11557.lovable.app

当前状态：预览已核验，未公开发布，未配置 GitHub 双向同步。详情见 `docs/web-factory/LOVABLE_HANDOFF.md`。

## 正式网站与驱动

访问 https://federated-bms.lovable.app ，在电脑 Chrome / Edge 中选择 USB 串口并开始采集。网站云端托管，BMS 数据仍在当前浏览器处理。
“连接设置”提供 WCH 官方 macOS 驱动、Windows 驱动页面及安装说明。已识别的串口无需重复安装。

## 24S / 36S update and sync repository

Local code now supports both configurations. The Lovable-connected repository is https://github.com/RoundBamb00/federated-bms (hyphen), checked out at `/Users/cliffcedar/Desktop/BMS/SRC/Federated_BMS_Web`. This original underscore repository remains preserved. Future deployment edits should be made locally in the sync checkout. See `docs/web-factory/LOCAL_36S_UPDATE.md` for protocol, verification, and the outstanding GPT Image 2 logo gate.
