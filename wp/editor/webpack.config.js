const path = require('path');
const wpConfig = require('@wordpress/scripts/config/webpack.config');

// Newer @wordpress/scripts versions may export [scriptConfig, moduleConfig].
const defaultConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;

/** Explicit entry name and output path so the plugin can rely on build/editor/index.* */
module.exports = {
  ...defaultConfig,
  entry: {
    index: path.resolve(__dirname, 'src/index.tsx'),
  },
  output: {
    ...defaultConfig.output,
    path: path.resolve(__dirname, '../plugin/build/editor'),
  },
};
