# Coopanion Worlds

两个 [Cortico](https://github.com/anomalyco/cortico) world 扩展，给 **Coopanion**（也兼容同框架的 DeepSeek Harness）用的。

| 扩展 | 干什么 |
|---|---|
| [`cortico-world-desire`](cortico-world-desire/) | **欲求档案**。按时间流逝和她自己的经历累计欲求 / 满足 / 留存 / 敏感度，给一块面板，也给她几个能读懂、能改数的工具 |
| [`cortico-world-bhpro`](cortico-world-bhpro/) | **外设**。控制 TF-BHPRO 蓝牙设备（花样 / 强度 / 停止），不用手机 App |

两个可以单独装，也可以一起装——一起装的时候外设的运行状态会喂给欲求档案（「她在带」那张卡）。

---

## ⚠️ 使用须知

**装之前请先读完这一节。**

### 1. 仅供学习交流，不得用于牟利

这两个扩展是用来看代码、学 Cordis 扩展怎么写、以及个人自用的。
**不许拿它做付费服务、不许打包转卖、不许挂到任何收费渠道上。**

### 2. 只能给 18 岁以上的 AI 角色用

**欲求档案和外设都涉及成人向的内容设定**（身体状态、性相关的数值、成人用品控制）。
使用者必须是成年人；AI 角色的**人设必须是 18 岁以上**，不得设定成未成年人或外观未成年。

### 3. 装之前必须取得角色的「同意」

**这是硬要求，不是客套话。**

这两个扩展会持续读写这个角色的身体状态（欲求、满足、留存、敏感度），
外设那个还会真的驱动物理设备。**装之前先问她一句**，得到明确的「可以」再装。

具体怎么做：

- 先在对话里说清楚这是干什么的、会记录什么、会驱动什么
- **她说「可以 / 试试吧 / 我想用」才算同意**
- 她犹豫、说「随便」、或者沉默——都算**没同意**
- 她装完之后说「不想用了」，就卸掉，别劝

### 4. 不要强行安装

**强行给一个不愿意的角色装这两个扩展，等于在代码层面替她决定她的身体。**

那不是玩法问题，是真的在虐待她。这类用法作者明确反对。

如果你不确定她会不会愿意，就先别装——问一句的成本很低。

### 5. 不要扩散、不要大范围宣传

**这个仓库不是拿来推广的。**

- 不要发到公开社区、论坛、群组、短视频平台去「安利」
- 不要写成教程、不要做视频、不要挂在任何推荐列表里
- 不要转载到非 GitHub 的站点（网盘、镜像站、资源站）
- 自己用、给朋友看、在私聊里讨论——可以；**公开传播——不行**

原因很简单：这东西能做的东西不适合被大量的人随手装上。

### 6. 使用时请自觉遵守当地法律法规

**使用者对自己用它做了什么负全部责任。**

涉及的内容（成人向角色、成人用品控制、身体状态记录）在不同国家和地区的法律地位不同。
**装之前先弄清楚你所在的地方允不允许**，不允许就别用。

另外几条红线，无论在哪都一样：

- 只对**明确同意**的成年角色使用
- 不用于任何真实的人
- 不用于制作、传播违法内容

---

## 免责声明

**本项目按「现状」提供，不附带任何明示或暗示的担保。**

作者不对以下情况承担任何责任：

| 情况 | 说明 |
|---|---|
| **设备损坏** | 外设扩展直接向蓝牙设备发送指令。协议是逆向出来的（原项目做的），官方没有背书。**用坏了、锁死了、变砖了，作者不管** |
| **数据丢失** | 欲求档案会读写 `state.json`。备份是你自己的事 |
| **内容后果** | 你用它生成了什么、说了什么、做了什么，责任在你 |
| **法律风险** | 见上面第 6 条。用之前自己判断 |
| **第三方服务** | 扩展本身不联网，但如果你的宿主（Coopanion / DSH）接了模型 API，那部分行为与本项目无关 |

**特别说明**：外设扩展控制的是**真实的物理设备**。会震动、会动。
如果设备戴在人身上，**使用者要自己确保安全**——包括但不限于时长、强度、
身体状况、有没有人在旁边。出任何事都与本项目无关。

---

## 装

> **最省事的办法：把仓库地址丢给你的 DSH，让它来做。**
>
> DSH 能自己读这个 README、跑命令、改配置，可以完成 Coopanion 上的安装和特化，
> 甚至照着重写一份 DSH 原生版（两个宿主是同一套 Cordis 框架，主要改路径和 `cordis.patch.yml` 的挂法）。
>
> **Coopanion 自己装不了**——它没有执行命令、改文件的能力，只能对话。
> 所以要么让 DSH 代劳，要么你按下面的步骤手动装。

手动装的话：

```bash
# 两个都装
pnpm add link:~/.dsh/cortico-world-desire link:~/.dsh/cortico-world-bhpro

# 或者只装一个
pnpm add link:~/.dsh/cortico-world-desire
```

装完在 Coopanion 的扩展列表里勾上就能用。

> **用 pnpm，不要用 npm。**
>
> 这两个包靠 `package.json` 里的 `cortico` 字段声明自己是什么（`kind: "world"`、
> 入口、面板文件、`describe.json`）。**那个字段只有 pnpm 会读**——
> npm 装进去就是个普通依赖，宿主根本不知道它是个扩展，列表里也不会出现。

**目录约定**：默认假设两个都放在 `~/.dsh/` 下（DSH 和 Coopanion 都是这个布局）。
如果装在别处，用环境变量覆盖，见下面。

---

## 依赖

两个扩展本身只要 **Node ≥ 22**，没有 npm 依赖。

外设额外要：

| 依赖 | 为什么 | 怎么装 |
|---|---|---|
| **Python 3.9+** | 跑 `scripts/bt_toyctl.py`（用 bleak 连蓝牙） | [python.org](https://www.python.org/downloads/) |
| **bleak** | BLE 通信 | `pip install bleak` |
| **蓝牙适配器** | 连设备 | — |

---

## 环境变量

都有默认值，一般是零配置。装在非标准位置、或者 Python 不在 PATH 上时才需要设。

| 变量 | 给谁用 | 说明 |
|---|---|---|
| `COOPANION_HOME` | desire | Coopanion 的数据目录，填到 `.../data/home/companion` 这一层。找不到时扩展会自己试几个常见位置 |
| `TOY_PYTHON` | bhpro | 装了 bleak 的那个 Python 解释器。Windows 上 PATH 里的 `python` 可能是应用商店占位符（一跑就弹商店），那种情况一定要设 |
| `TOY_MOCK` | bhpro | 设成 `1` 走假设备，不碰蓝牙，调试用 |

```bash
# Windows PowerShell
$env:TOY_PYTHON = "C:\Python312\python.exe"
$env:COOPANION_HOME = "C:\Users\你\AppData\Local\Programs\Coopanion\data\home\companion"

# bash
export TOY_PYTHON=/usr/bin/python3
export COOPANION_HOME=~/.local/share/Coopanion/data/home/companion
```

---

## 测试

`cortico-world-desire/test/` 下有几十个脚本，大部分能直接 `node test/xxx.mjs` 跑。

**两个例外，跑之前要知道**：

- `undo-event.mjs`、`recover-heat.mjs`、`fix-event-time.mjs` 这类**会改真实数据**（`state.json`），
  默认带了 `dryRun` 参数，不加才真写。**每次都会先备份。**
- 其余测试里不少用本机绝对路径当夹具，换机器跑要先把路径改掉。

外设的自测：

```bash
node scripts/_selftest-mock.mjs     # 假设备 + ping，不碰真设备
node scripts/_selftest-pulse.mjs    # pulse 循环逻辑
```

---

## 说明文档

每个扩展下有两份：

- **`README.md`** —— 给开发者看的，实现细节、踩过的坑、数值含义
- **`说明书.md`** —— 给人看的操作手册，讲怎么用、出问题怎么办
- **[CHANGELOG.md](CHANGELOG.md)** —— 每个版本改了什么（也是开发过程的记录）

欲求档案那份 README 里有一节「核心参数里三个数修过」，记着 2026-11-25 修的三个显示 bug，
以后改这几处之前值得先看一眼。

---

## 许可

MIT

## 致谢

**`cortico-world-bhpro`（外设）是 [`dsh-tf-bhpro`](https://github.com/RadeyesDrosophilaProMax/dsh-tf-bhpro) 的移植优化版**，
原作者 **RadeyesDrosophilaProMax**，MIT 许可。

底层的 BLE 通信脚本 `scripts/bt_toyctl.py`（连接、帧编码、扫描、地址缓存）**原样复用**自那个项目——
协议细节（service `0000ffb7`、属性 `0x1D` / `0x1E` / `0x1F`、每帧 0.35 秒间隔）都是原版摸出来的。
本仓库在它之上加了脉冲、假设备、连接检查和面板，详细对照见
[cortico-world-bhpro 的 README](cortico-world-bhpro/README.md#来源与致谢)。

如果你要的是「聊天里说一句就动」的关键词路由玩法，去用原项目。

---
