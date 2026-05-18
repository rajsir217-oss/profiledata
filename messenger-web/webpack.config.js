const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const fs = require('fs');

const MESSENGER_SRC = path.resolve(__dirname, '../messenger/src');

const loadEnvFile = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch (_) {
    return {};
  }
};

module.exports = (env, argv) => {
  const isProduction = (argv && argv.mode === 'production') || process.env.NODE_ENV === 'production';
  const envFile = isProduction ? '.env.production' : '.env.local';
  const envVars = loadEnvFile(path.resolve(__dirname, envFile));
  const defineEnv = Object.fromEntries(
    Object.entries(envVars).map(([k, v]) => [`process.env.${k}`, JSON.stringify(String(v))])
  );
  const processEnvObject = {
    NODE_ENV: isProduction ? 'production' : 'development',
    ...envVars,
  };
  return {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'eval-source-map',
  entry: path.resolve(__dirname, 'index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/utils/asyncStorage.js'),
      '@messenger/stores': path.resolve(__dirname, '../messenger/src/stores'),
      '@messenger/services': path.resolve(__dirname, '../messenger/src/services'),
      '@messenger/config': path.resolve(__dirname, '../messenger/src/config'),
      '@messenger/utils': path.resolve(__dirname, '../messenger/src/utils'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    modules: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../messenger/node_modules'),
    ],
  },
  resolveLoader: {
    modules: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../messenger/node_modules'),
    ],
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
      },
      {
        test: /\.(png|jpe?g|gif|webp|svg|ttf|woff2?)$/,
        type: 'asset/resource',
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            configFile: false,
            babelrc: false,
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
            plugins: ['react-native-web'],
          },
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __DEV__: JSON.stringify(!isProduction),
      process: `({ env: ${JSON.stringify(processEnvObject)} })`,
      // Use dotted keys so webpack replaces `process.env.X` directly with
      // string literals (not the whole `process.env` object).
      // Critical: react / react-native-web / react-dom check NODE_ENV at
      // runtime and behave very differently in dev vs prod. Replacing the
      // whole `process.env` with `JSON.stringify({...})` substitutes a
      // STRING value, making `.NODE_ENV` return undefined and breaking
      // image rendering (Image component never transitions out of IDLE state).
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
      ...defineEnv,
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'web/index.html'),
    }),
  ],
  devServer: {
    port: 3030,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.resolve(__dirname, 'web'),
    },
  },
  };
};
