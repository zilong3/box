import os from 'node:os';
import path from 'node:path';

import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';

const rootDir = import.meta.dirname;
const srcDir = path.resolve(rootDir, 'src');
// KernelSU 会加载模块根目录 webroot/ 下的 index.html，构建产物直接输出到那里。
// 仓库布局：<repo>/box/（模块运行数据）、<repo>/box_for_root/（KernelSU 模块部分，含 webroot/）
// 与 <repo>/ui/（本工程）平级，所以产物输出到同级的 box_for_root/webroot/。
const moduleDir = path.resolve(rootDir, '..', 'box_for_root');
const outputDir = path.resolve(moduleDir, 'webroot');

// 产物完全扁平化：index.html / main.*.js / main.*.css / 静态资源全部放在 webroot/ 根下，
// 不再有 assets/、js/、css/ 这类子目录，生成的引用形如
// <script src="main.xxxxxxxx.js">、<link href="main.xxxxxxxx.css">。
// 好处：file:// 与 KernelSU 的 https://mui.kernelsu.org/ 加载方式下相对路径更简单，
// 模块 zip 内 webroot/ 只有一层，便于排查与替换。
const staticDir = path.resolve(rootDir, 'static');

// 默认监听 0.0.0.0，手机浏览器可通过局域网地址直接打开开发页面
// 不想暴露到局域网时：DEV_HOST=127.0.0.1 npm start
const devHost = process.env.DEV_HOST ?? '0.0.0.0';
// 未指定 DEV_PORT 时，自动从 5173 起找一个空闲端口，用满了再顺延。
// 注意：webpack-dev-server 在 port: 'auto' 时取的是 WEBPACK_DEV_SERVER_BASE_PORT
// 环境变量，默认值 8080，所以必须显式把起止端口写进 env，否则"顺延"永远发生在 8080。
// 指定 DEV_PORT 时使用固定端口，被占用则直接报错，不再顺延。
const preferredPort = Number(process.env.DEV_PORT ?? 5173);
const useFixedPort = Boolean(process.env.DEV_PORT);
const devPort = useFixedPort ? preferredPort : 'auto';

/** 收集局域网 IPv4 地址，用于启动后提示手机访问地址 */
function lanIPv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((info) => info && info.family === 'IPv4' && !info.internal)
    .map((info) => info.address);
}

/** 监听成功后打印可访问地址（端口被占用而自动顺延、或指定 0 端口时都显示真实端口） */
function printDevHint(server) {
  const address = server.server.address();

  if (!address || typeof address === 'string') {
    return;
  }

  const { port, address: bound } = address;
  const lanAddresses = bound === '0.0.0.0' || bound === '::' ? lanIPv4Addresses() : [];
  // 只有确实从 preferredPort 顺延了才提示，避免显示成"端口被占用"的误导信息
  const portNote =
    !useFixedPort && port !== preferredPort
      ? `（端口 ${preferredPort} 被占用，已顺延到 ${port}）`
      : '';

  console.log('');
  console.log(`  📦 Box for Root 控制面板 · 开发服务器已启动${portNote}`);
  console.log(`     本机:   http://127.0.0.1:${port}`);
  for (const ip of lanAddresses) {
    console.log(`     局域网: http://${ip}:${port}`);
  }
  if (lanAddresses.length > 0) {
    console.log('     （手机与电脑处于同一网络时，直接用局域网地址打开）');
  }
  console.log('     预览模式下 KernelSU 桥接为 mock，不会执行真实命令');
  console.log('');
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ mode?: 'development' | 'production' }} argv
 */
export default (env, argv) => {
  const isProd = argv.mode === 'production';
  // port: 'auto' 时由 webpack-dev-server 从 WEBPACK_DEV_SERVER_BASE_PORT 开始找空闲端口并重试；
  // dev-server 与 webpack 配置同进程，这里直接写 process.env 即可
  if (!useFixedPort) {
    process.env.WEBPACK_DEV_SERVER_BASE_PORT = String(preferredPort);
    process.env.WEBPACK_DEV_SERVER_PORT_RETRY ??= '20';
  }
  // 生产环境把样式抽成独立文件，开发环境用 style-loader 以便热更新
  const styleLoader = isProd ? MiniCssExtractPlugin.loader : 'style-loader';

  /** css-loader 的通用配置 */
  const cssLoader = (modules) => ({
    loader: 'css-loader',
    options: {
      importLoaders: 1,
      modules,
    },
  });

  const lessLoader = {
    loader: 'less-loader',
    options: {
      lessOptions: {
        javascriptEnabled: true,
      },
    },
  };

  const modulesOptions = {
    auto: true,
    // css-loader 7 默认开启具名导出，这里保持 `import styles from './x.module.less'` 的写法
    namedExport: false,
    exportLocalsConvention: 'camelCaseOnly',
    localIdentName: isProd ? '[hash:base64:6]' : '[path][name]__[local]',
  };

  return {
    mode: argv.mode ?? 'development',
    target: ['web', 'es2022'],
    entry: path.resolve(srcDir, 'main.tsx'),
    output: {
      path: outputDir,
      // 全部输出到 webroot/ 根下，index.html 与 js/css 同级同目录
      filename: isProd ? '[name].[contenthash:8].js' : '[name].js',
      chunkFilename: isProd ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js',
      assetModuleFilename: '[name].[contenthash:8][ext]',
      // KernelSU/Magisk 的 WebView 可能以 file:// 或 https://mui.kernelsu.org/ 加载页面，
      // 因此使用相对路径解析资源
      publicPath: 'auto',
      clean: isProd,
    },
    devtool: isProd ? false : 'eval-cheap-module-source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      alias: {
        '@': srcDir,
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          include: srcDir,
          use: [
            {
              loader: 'ts-loader',
              options: {
                // 类型检查交给 `npm run typecheck`，构建只做转译，速度更快
                transpileOnly: true,
              },
            },
          ],
        },
        {
          test: /\.module\.less$/,
          use: [styleLoader, cssLoader(modulesOptions), lessLoader],
        },
        {
          test: /\.less$/,
          exclude: /\.module\.less$/,
          use: [styleLoader, cssLoader({ auto: false }), lessLoader],
        },
        {
          test: /\.css$/,
          use: [styleLoader, 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024,
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(rootDir, 'public', 'index.html'),
        filename: 'index.html',
        inject: 'body',
        templateParameters: {
          // 仅 KernelSU 提供 internal/insets.css（刘海/手势区安全边距）
          ksuInsets: isProd,
        },
        minify: isProd && {
          collapseWhitespace: true,
          removeComments: true,
        },
      }),
      ...(isProd
        ? [
            new MiniCssExtractPlugin({
              filename: '[name].[contenthash:8].css',
              chunkFilename: '[name].[contenthash:8].chunk.css',
            }),
          ]
        : []),
      // 需要外链的文件放进 ui/static/，会被原样拷贝到 webroot/ 根下
      new CopyPlugin({
        patterns: [
          {
            from: staticDir,
            to: outputDir,
            noErrorOnMissing: true,
            // 顺带跳过点开头的隐藏文件（.DS_Store 之类）
            globOptions: { ignore: ['**/.*'] },
          },
        ],
      }),
    ],
    optimization: {
      minimize: isProd,
      minimizer: [
        // extractComments: false，避免产出 *.LICENSE.txt 干扰模块包目录
        new TerserPlugin({ extractComments: false }),
        new CssMinimizerPlugin(),
      ],
    },
    performance: {
      // 扁平化后根目录只有几个文件，但 js 体积本身较大，这里不启用体积提示
      hints: false,
    },
    devServer: {
      host: devHost,
      port: devPort,
      hot: true,
      open: false,
      historyApiFallback: true,
      onListening: printDevHint,
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
    },
    stats: 'minimal',
    infrastructureLogging: {
      level: 'warn',
    },
  };
};
