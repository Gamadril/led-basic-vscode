'use strict';
const SerialPort = require('./serialport');
const Binding = require('./bindings/auto-detect');

/**
 * @type {BaseBinding}
 */
SerialPort.Binding = Binding;


module.exports = SerialPort;
