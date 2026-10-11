const path = require('path');
const wpConfig = require('@wordpress/scripts/config/webpack.config');

// Newer @wordpress/scripts versions may export [scriptConfig, moduleConfig].
const defaultConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;

/**
 * Explicit entries and output path so the plugin can rely on
 * build/editor/index.* (editor app) and build/editor/blocks.* (block registration).
 */
module.exports = {
  ...defaultConfig,
  entry: {
    index: path.resolve(__dirname, 'src/index.tsx'),
    blocks: path.resolve(__dirname, 'src/blocks/index.tsx'),
  },
  output: {
    ...defaultConfig.output,
    path: path.resolve(__dirname, '../plugin/build/editor'),
  },
};
