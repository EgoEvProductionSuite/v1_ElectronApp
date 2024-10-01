// electron-app/renderer/webpack.config.js

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  // Set the context to the renderer directory
  context: path.resolve(__dirname),

  // Entry point of the application
  entry: path.resolve(__dirname, 'src', 'index.jsx'),

  // Output configuration
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true, // Cleans the output directory before emit
  },

  // Mode configuration
  mode: isDevelopment ? 'development' : 'production',

  // Target Electron renderer process
  target: 'electron-renderer',

  // Module rules
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // Transpile JS and JSX files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/, // Handle CSS files
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|gif|svg)$/, // Handle image assets
        type: 'asset/resource',
      },
    ],
  },

  // Resolve extensions
  resolve: {
    extensions: ['.js', '.jsx'],
  },

  // Plugins
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public', 'index.html'), // HTML template
      filename: 'index.html',
    }),
  ],

  // Source maps
  devtool: isDevelopment ? 'source-map' : false,

  // Optimization
  optimization: {
    minimize: !isDevelopment,
  },
};
