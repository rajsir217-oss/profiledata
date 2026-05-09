const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const MESSENGER_SRC = path.resolve(__dirname, '../messenger/src');

module.exports = (env, argv) => {
  const isProduction = (argv && argv.mode === 'production') || process.env.NODE_ENV === 'production';
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
      'process.env': JSON.stringify({
        NODE_ENV: isProduction ? 'production' : 'development',
      }),
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
