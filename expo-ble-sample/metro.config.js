const { getDefaultConfig } = require('@expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Bloqueamos cualquier carpeta .cxx dentro de node_modules
config.resolver.blockList = exclusionList([
  /node_modules\/.*\/\.cxx\/.*/,
]);

module.exports = config;
