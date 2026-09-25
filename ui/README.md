# Box for Root UI

模块控制面板前端工程，基于 **React + TypeScript + Ant Design + Webpack + Less Modules**，
通过 KernelSU 的 WebUI 桥接（`window.ksu`）与模块脚本通信。

本工程位于仓库根目录的 `ui/`，与模块运行数据 `box/`、KernelSU 模块部分 `box_for_root/` 平级；
构建产物输出到 `../box_for_root/webroot/`，由 `box_for_root/build.sh` 随模块一起打包。

## 开发与构建

```bash
cd ui
npm install          # 首次安装依赖
npm start            # 开发服务器，启动后会打印本机/局域网访问地址
npm run build        # 生产构建，产物输出到 ../box_for_root/webroot
npm run typecheck    # 类型检查（ts-loader 只转译，不做类型检查）
```

`npm start` 启动后终端会直接给出可访问地址：

```text
  📦 Box for Root 控制面板 · 开发服务器已启动
     本机:   http://127.0.0.1:5173
     局域网: http://192.168.31.9:5173
     （手机与电脑处于同一网络时，直接用局域网地址打开）
     预览模式下 KernelSU 桥接为 mock，不会执行真实命令
```

- 默认监听 `0.0.0.0`，方便手机浏览器直接打开开发页面；不想暴露到局域网用
  `DEV_HOST=127.0.0.1 npm start`。
- 默认端口从 5173 起找空闲端口，被占用时自动顺延（提示里会标注真实端口）。
  想固定端口用 `DEV_PORT=9000 npm start`，此时端口被占用会直接报错，不会静默换端口。
- 顺延时的起始端口由 `WEBPACK_DEV_SERVER_BASE_PORT` 控制（配置文件里已按上一条自动设置），
  顺延次数默认 20，可用 `DEV_PORT_RETRY` 调整。

构建产物**完全扁平化**：`index.html`、`main.*.js`、`main.*.css` 以及静态资源都输出到
`box_for_root/webroot/` 同一层目录下，没有 `assets/`、`js/`、`css/` 这类子目录（`box_for_root/webroot/` 由模块
打包进 zip，KernelSU 加载其中的 `index.html`）：

```text
box_for_root/webroot/
├── index.html
├── main.<contenthash>.js
├── main.<contenthash>.css
└── <其他静态资源，如 main.<contenthash>.svg>
```

`index.html` 中的引用也相应地是同级相对形式：

```html
<link href="main.a2786bfb.css" rel="stylesheet">
<script defer src="main.f894cb28.js"></script>
```

好处是 `file://` 与 KernelSU 的 `https://mui.kernelsu.org/` 两种加载方式下路径解析都最简单，
zip 内 `webroot/` 只有一层，排查或手动替换文件时不用逐层找目录。

> - `webpack.config.js` 中 `output.clean` 仅在生产构建时开启，会清空 `box_for_root/webroot/` 后重新输出；
>   `npm run dev` 只在内存中编译，不会改动 `box_for_root/webroot/`。
> - 需要外链的文件放进 `ui/static/`，构建时会被 `copy-webpack-plugin` 原样拷贝到 `box_for_root/webroot/` 根下
>   （目录不存在时静默跳过）。因为整个 `webroot/` 会被 `clean` 清空，这类文件不要直接写在 `webroot/` 里。
> - 目前只有单个入口，所以产物就是上面三个文件；若将来开启代码分割，chunk 也会落在同一层
>   （`[name].<contenthash>.chunk.js`）。

## 目录结构

```text
ui/
├── public/index.html        # HtmlWebpackPlugin 模板
├── static/                  # 可选：需要原样拷贝到 box_for_root/webroot/ 根下的静态文件
├── src/
│   ├── main.tsx             # 入口，挂载 React
│   ├── app/                 # 根组件与布局
│   ├── bridge/              # KernelSU 桥接：ksu(机制) / api(白名单动作与解析)
│   ├── components/          # 业务组件（*.module.less 为局部样式）
│   ├── styles/global.less   # 全局样式
│   └── types/               # *.d.ts：window.ksu 声明、静态资源声明
├── tsconfig.json
└── webpack.config.js
```

## 桥接用法

面板与内核之间只有**一条**通道。业务代码只认一个入口：`@/bridge`。

```text
组件 / state
    │  import { panel } from '@/bridge'  ← 只调具名方法，不碰命令字符串
    ▼
@/bridge/ksu.ts          ← 机制层：window.ksu 封装（exec 不对外）
@/bridge/api.ts          ← 翻译层：白名单动作 + 参数转义 + KSU_* 输出解析
    │  唯一出口 runCommand()
    ▼
box/scripts/box.webui    ← 脚本层：唯一命令入口 + 二次白名单校验
    │
    ├── box.service      启停核心
    ├── box.iptables     透明代理规则
    └── box.tool         更新、检查、内核面板
```

```ts
import { panel } from '@/bridge';

const status = await panel.queryServiceStatus();
await panel.runServiceCommand('start');
const { content } = await panel.tailLog('tool.log', 200);
```

**面板不自己执行任何命令。** `exec` / `runCommand` 只允许 `@/bridge/api` 内部使用，
业务代码不需要（也拿不到）它们。需要新能力时按三步走：

1. 在 `box/scripts/box.webui` 的 `BOX_WEBUI_ACTIONS` 里加一个 action；
2. 在 `ui/src/bridge/api.ts` 加一个同名方法，把输出解析成类型化对象，
   并挂到文件底部的 `panel` 对象上；
3. 组件调用该方法。

这样做的收益：

- **安全**：命令集合是一张固定白名单。`ksu.exec` 把命令交给 `su -c`，等于又过一层
  shell，因此 api 层对每个参数单独做 POSIX 引号包裹（`runCommand`）；
  日志文件名等输入在脚本侧还会再校验一次（只接受 run 目录下真实存在的 `*.log`）。
- **简单**：组件不需要知道脚本叫什么、在哪、子命令怎么拼、输出怎么解析。
- **单一事实来源**：服务状态探测、日志清单、规则重建都只有脚本侧一份实现
  （`box.webui` 的 `do_status` / `list_log_files` / `box.iptables renew`），
  前端不再内嵌任何 shell 副本。

脚本侧的结构化动作把结果写成 `KSU_<TAG>|字段|...` 单行文本，由 api 层解析：

```text
KSU_STATUS|12345|3600|sing-box|tproxy|blacklist|/data/adb/box/sing-box/config.json|1.10.1
KSU_LOG|tool.log|18422|1758800000
KSU_TAIL|tool.log|200|842          # 文件名 | 读取行数 | 文件总行数
<日志正文…>
```

`tail` 的正文**跟在记录行之后**，api 层以 `KSU_TAIL` 行作为分界来取正文，
所以脚本哪怕往 stdout 多打了别的诊断行，也不会把日志内容吃掉。

两边漂移时可以在控制台执行 `await panel.selfCheck()`，它会比对脚本的 action 列表与
前端声明是否一致（`missing` 里的每一项都意味着一个必然失败的功能）。

非 KernelSU 环境（浏览器 `npm start`）下 api 层返回预览数据，不执行任何命令，
`toast` 输出到控制台，页面仍可正常渲染。

## 约定

- 别名 `@` → `src`（webpack `resolve.alias` 与 tsconfig `paths` 需同步修改）。
- 样式文件命名为 `*.module.less` 时启用 CSS Modules，类名使用小驼峰（`exportLocalsConvention: camelCaseOnly`）。
- 资源路径使用相对形式（`publicPath: 'auto'` + 扁平化的 `output.filename`），以兼容 `file://` 与
  `https://mui.kernelsu.org/` 两种加载方式。
- 构建产物不加子目录：`output.filename` / `chunkFilename` / `assetModuleFilename` 与
  `MiniCssExtractPlugin` 的 `filename` 都直接写在 `box_for_root/webroot/` 根下，改路径时这几处要一起改。
