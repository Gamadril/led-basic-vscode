'use strict';

const path = require('path');
const fs = require('fs');

const loadLibrary = (parentFolder) => {
  const folderPath = parentFolder;
  //const folderPath = path.join(parentFolder, '../../build/Release');
  //const folderPath = path.join(parentFolder, '../../build/Debug'); // DEBUGGING
  const dirCont = fs.readdirSync(folderPath);
  const files = dirCont.map(file => {
    if (file.endsWith('.node')) {
      return path.join(folderPath, file);
    }
  }).filter(path => path);

  var binding = null;
  files.find((file) => {
    try {
      var _temp = require(file);
      binding = _temp;
      console.log('[native-loader] using', file);
      return true;
    } catch (e) {
      console.log('[native-loader] error', e.message);
      return false;
    }
  });

  if (!binding) {
    console.log('[native-loader][ERROR] No library available after trying files', files);
  }

  return binding;
};

exports.load = loadLibrary;