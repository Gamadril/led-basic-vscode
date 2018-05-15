'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

function promisify(func) {
  return (arg) => {
    return new Promise((resolve, reject) => {
      func(arg, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  };
}

function promisedFilter(func) {
  return (data) => {
    var shouldKeep = data.map(func);
    return Promise.all(shouldKeep).then((keep) => {
      return data.filter((path, index) => {
        return keep[index];
      });
    });
  };
}

var statAsync = promisify(fs.stat);
var readdirAsync = promisify(fs.readdir);
var execAsync = promisify(childProcess.exec);

function udevParser(output) {
  var udevInfo = output.split('\n').reduce((info, line) => {
    if (!line || line.trim() === '') {
      return info;
    }
    var parts = line.split('=').map((part) => {
      return part.trim();
    });

    info[parts[0].toLowerCase()] = parts[1];

    return info;
  }, {});

  return {
    comName: udevInfo.devname,
    manufacturer: udevInfo.id_vendor,
    serialNumber: udevInfo.id_serial_short,
    deviceName: udevInfo.id_model,
    bcdDevice: parseInt(udevInfo.id_revision, 16),
    vendorId: parseInt(udevInfo.id_vendor_id, 16),
    productId: parseInt(udevInfo.id_model_id, 16)
  };
}

function checkPathAndDevice(path) {
  // get only serial port names
  if (!(/ttyACM/).test(path)) {
    return false;
  }
  return statAsync(path).then((stats) => {
    return stats.isCharacterDevice();
  });
}

function lookupPort(file) {
  var udevadm = `udevadm info --query=property -p $(udevadm info -q path -n ${file})`;
  return execAsync(udevadm).then(udevParser);
}

function listUnix(callback) {
  var dirName = '/dev';
  readdirAsync(dirName)
    .then(data => {
      return data.map(file => {
        return path.join(dirName, file)
      })
    })
    .then(promisedFilter(checkPathAndDevice))
    .then(data => {
      return Promise.all(data.map(lookupPort))
    })
    .then(data => {
      return data.filter(dev => {
        return dev.vendorId === 0x16C0;
      });
    })
    .then(data => {
      callback(null, data)
    }, err => {
      callback(err)
    });
}

module.exports = listUnix;