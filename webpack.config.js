const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const webpack = require('webpack');
const path = require('path');

// Load environment variables
require('dotenv').config();

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',

    // This is necessary because Figma's 'eval' works differently than normal eval
    devtool: isProduction ? false : 'inline-source-map',

    entry: {
      ui: './src/app/index.tsx', // The entry point for your UI code
      code: './src/plugin/controller.ts', // The entry point for your plugin code
    },

    module: {
      rules: [
        // Converts TypeScript code to JavaScript
        { 
          test: /\.tsx?$/, 
          use: {
            loader: 'ts-loader',
            options: {
              // Enable transpileOnly for faster builds
              transpileOnly: true,
              compilerOptions: {
                // Override module type for webpack build to support dynamic imports
                module: 'esnext',
                target: 'es2020',
              }
            }
          }, 
          exclude: /node_modules/ 
        },

        // Enables including CSS by doing "import './file.css'" in your TypeScript code
        { test: /\.css$/, use: ['style-loader', { loader: 'css-loader' }] },

        { 
          test: /\.(png|jpg|gif|webp|svg)$/, 
          type: 'asset/inline' // Always inline as data URI for Figma plugin
        },
      ],
    },

    // Webpack tries these extensions for you if you omit the extension like "import './file'"
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'] },

    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'), // Compile into a folder called "dist"
      clean: true, // Clean the output directory before emit
    },

    // Optimization configuration
    optimization: {
      // Enable tree shaking
      usedExports: true,
      sideEffects: false,
      
      // Split chunks for better caching and smaller bundles
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Separate React into its own chunk
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20,
          },
          // Separate react-markdown into its own chunk (it's quite large)
          markdown: {
            test: /[\\/]node_modules[\\/]react-markdown[\\/]/,
            name: 'markdown',
            chunks: 'all',
            priority: 15,
          },
          // Other vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all',
            priority: 10,
          },
        },
      },
      
      // Minimize bundle size in production
      minimize: isProduction,
      
      // Remove unused modules
      providedExports: true,
      
      // Concatenate modules when possible
      concatenateModules: isProduction,
    },

    // Performance hints configuration
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 300000, // 300kb - slightly higher for Figma plugins
      maxAssetSize: 300000,
    },

    // Tells Webpack to generate "ui.html" and to inline chunks appropriately
    plugins: [
      // Define environment variables for the frontend
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.NGROK_URL': JSON.stringify(process.env.NGROK_URL),
        'process.env.SERVER_URL': JSON.stringify(
          isProduction 
            ? 'https://figma-comment-summary.onrender.com'
            : process.env.NGROK_URL || 'http://localhost:3000'
        ),
      }),
      
      new HtmlWebpackPlugin({
        template: './src/app/index.html',
        filename: 'ui.html',
        chunks: ['ui', 'react', 'vendor'], // Include all chunks
        cache: false,
        inject: 'body', // Inject scripts at the end of body
      }),
      // Inline all chunks for Figma plugin compatibility
      new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/.*/]), // Inline all chunks
    ],

    // External dependencies - if you want to exclude certain large libraries
    // Uncomment and configure if needed
    // externals: {
    //   // 'react': 'React',
    //   // 'react-dom': 'ReactDOM',
    // },
  };
};
