const { resolve, basename } = require('path');
const { existsSync, readdirSync, rmSync, copyFileSync } = require('fs');
const ts = require('typescript');
const glob = require('glob');
const ESLintPlugin = require('eslint-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const paths = require('../paths.js');
const { name: appName } = require(paths.appPackageJson);

const isDevServer = process.env.WEBPACK_SERVE;
const devServerPort = process.env.DEV_SERVER_PORT ??
  (console.log('DEV_SERVER_PORT env var is required!') || process.exit());

module.exports = function (mode = 'development') {
  const isDevelopmentBuild = mode === 'development';
  const isProductionBuild = mode === 'production';

  // noinspection WebpackConfigHighlighting
  return {
    mode: isProductionBuild ? 'production' : 'development',
    entry: isDevServer ? paths.appIndex : paths.appMain,
    output: {
      filename: 'index.js',
      path: paths.appBuild,
      libraryTarget: 'umd'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    optimization: {
      minimize: isProductionBuild,
    },
    externals: {
      ...!isDevServer ? {
        react: 'react'
      } : {}
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          include: paths.appSrc,
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            cacheCompression: false,
            compact: isProductionBuild
          },
        },
      ]
    },
    plugins: [
      new ESLintPlugin({
        extensions: ['ts', 'tsx'],
        overrideConfig: {
          rules: {
            'no-debugger': isDevelopmentBuild ? 'off' : 'error'
          }
        },
        failOnError: true
      }),
      new ForkTsCheckerWebpackPlugin({
        async: false
      }),
      {
        apply: compiler => {
          compiler.hooks.shouldEmit.tap('Plugin', (compilation) => {
            return !compilation.getStats().hasErrors();
          });
        }
      },
      {
        apply: compiler => {
          compiler.hooks.environment.tap('Plugin', () => {
            if (existsSync(paths.appBuild)) {
              readdirSync(paths.appBuild).forEach(baseName => {
                const path = resolve(paths.appBuild, baseName);

                rmSync(path, { recursive: true });
              });
            }
          });
        }
      },
      {
        apply: compiler => {
          compiler.hooks.environment.tap('Plugin', () => {
            if (existsSync(paths.appBuild))
              copyFileSync(paths.appPackageJson, resolve(paths.appBuild, basename(paths.appPackageJson)));
          });
        }
      },
      !isDevServer && {
        apply: compiler => {
          compiler.hooks.done.tap('Plugin', () => {
            setTimeout(() => {
              const files = glob.sync(resolve(paths.appSrc, '**/*{.ts,.tsx}'), {
                ignore: [paths.appIndex, paths.appTest]
              });
              const compilerOptions = {
                allowJs: true,
                declaration: true,
                emitDeclarationOnly: true,
                declarationDir: paths.appBuild
              };
              const host = ts.createCompilerHost(compilerOptions);
              const program = ts.createProgram(files, compilerOptions, host);

              program.emit();
            }, 0);
          });
        }
      },
      isDevServer && new HtmlWebpackPlugin({
        title: appName,
        template: paths.appHtml
      })
    ].filter(Boolean),
    stats: {
      colors: true,
      modules: false
    },
    devServer: {
      static: {
        directory: paths.appBuild,
      },
      compress: true,
      port: devServerPort,
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
      open: true
    },
    ...isDevelopmentBuild ? {
      devtool: 'cheap-module-source-map'
    } : {},
    infrastructureLogging: {
      level: 'none',
    },
  };
};
