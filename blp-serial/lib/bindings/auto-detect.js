'use strict';

switch (process.platform) {
  case 'win32':
    module.exports = require('./win32');
    break;
  case 'darwin':
    module.exports = require('./darwin');
    break;
  default:
    module.exports = require('./linux');
}