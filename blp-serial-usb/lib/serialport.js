const {
    Duplex
} = require('stream');
const path = require('path');
const binding = require('./native_loader').load(path.join(__dirname, 'native'));

const DATABITS = [5, 6, 7, 8];
const STOPBITS = [1, 1.5, 2];
const PARITY = ['none', 'even', 'mark', 'odd', 'space'];

const defaultSettings = {
    baudRate: 9600,
    dataBits: 8,
    hupcl: true,
    lock: true,
    parity: 'none',
    stopBits: 1,
    highWaterMark: 64 * 1024
};

function allocNewReadPool(poolSize) {
    const pool = Buffer.allocUnsafe(poolSize);
    pool.used = 0;
    return pool;
}

const _debug = false;
const debug = (...msg) => {
    if (_debug) console.log(msg.reduce((l, r) => {
        return JSON.stringify(l).replace(new RegExp('"', 'g'), '') + ' ' + JSON.stringify(r).replace(new RegExp('"', 'g'), '');
    }));
};

class SerialPort extends Duplex {

    constructor(path, options) {
        super({
            highWaterMark: defaultSettings.highWaterMark
        });

        if (typeof path !== 'string') {
            throw new TypeError('"path" is not defined.');
        }

        let parts = path.split(':');
        if (parts.length != 4 || parts[0] !== 'usb') {
            throw new TypeError('"path" has a wrong format.');
        }

        this.settings = Object.assign({}, defaultSettings, options);
        this.path = path;
        this.opening = false;
        this.closing = false;
        this.isOpen = false;
        this._kMinPoolSpace = 128;
        this._port = new binding.SerialPort();
        this.on('error', (err) => {
            console.log('---> ', err);
        });
    }

    /**
     * Retrieves a list of available serial ports with metadata.
     * @returns {Promise} resolves to an array of port info objects.
     */
    static list() {
        return new Promise((resolve, reject) => {
            try {
                var devs = binding.list();
                resolve(devs);
            } catch (e) {
                reject(e);
            };
        });
    }

    open(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('"callback" is not a function');
        }

        if (this.isOpen) {
            callback(new Error('Port is already open'));
            return;
        }

        if (this.opening) {
            callback(new Error('Port is opening'));
            return;
        }

        if (DATABITS.indexOf(this.settings.dataBits) === -1) {
            throw new TypeError('"databits" is invalid: ' + this.settings.dataBits);
        }

        if (STOPBITS.indexOf(this.settings.stopBits) === -1) {
            throw new TypeError('"stopbits" is invalid: ' + this.settings.stopBits);
        }

        if (PARITY.indexOf(this.settings.parity) === -1) {
            throw new TypeError('"parity" is invalid: ' + this.settings.parity);
        }

        this.opening = true;
        debug('opening', 'path:', this.path);
        this._port.open(this.path, this.settings, (error) => {
            this.opening = false;
            if (error) {
                debug('Binding #open had an error:', error.message);
                callback(error);
            } else {
                debug('opened', 'path:', this.path);
                this.isOpen = true;
                this.emit('open');
                callback();
            }
        });
    }

    close(callback) {
        if (!this.isOpen) {
            debug('close attempted, but port is not open');
            if (callback) {
                callback(new Error('Port is not open'));
            }
        }

        this.closing = true;
        debug('#close');
        this._port.close((error) => {
            this.closing = false;
            this.isOpen = false;
            if (error) {
                debug('binding.close', 'had an error', error.message);
                if (callback) {
                    callback(error);
                }
            } else {
                debug('binding.close', 'finished');
                if (callback) {
                    callback(error);
                }
            }
        });
    }

    set(options, callback) {
        if (typeof options !== 'object') {
            throw TypeError('"options" is not an object');
        }

        if (typeof callback !== 'function') {
            throw TypeError('"callback" is not a function');
        }

        if (!this.isOpen) {
            debug('set attempted, but port is not open');
            callback(new Error('Port is not open'));
            return;
        }

        //const settings = Object.assign({}, defaultSetFlags, options);
        const settings = Object.assign({}, options);
        debug('#set', settings);
        this._port.set(settings, (error) => {
            if (error) {
                debug('binding.set', 'had an error', error.message);
                callback(error);
            } else {
                debug('binding.set', 'finished');
                callback();
            }
        });
    }

    _write(chunk, encoding, callback) {
        if (!this.isOpen) {
            debug('_write attempted, but port is not open');
            callback(new Error('Port is not open'));
            return;
        }
        debug('_write', chunk.length, 'bytes of data');
        this._port.write(chunk, (error) => {
            if (error) {
                debug('binding.write', 'had an error', error.message);
                callback(error);
            } else {
                debug('binding.write', 'finished');
                callback();
            }
        });
    }

    _writev(chunk, callback) {
        debug('_writev', '{data.length', 'chunks of data');
        const dataV = chunk.map(write => write.chunk);
        this._write(Buffer.concat(dataV), null, callback);
    }

    _read(size) {
        if (!this.isOpen) {
            debug('_read attempted, but port is not open. queueing _read for after open');
            this.once('open', () => {
                this._read(size);
            });
            return;
        }

        if (!this._pool || this._pool.length - this._pool.used < this._kMinPoolSpace) {
            debug('_read', 'discarding the read buffer pool');
            this._pool = allocNewReadPool(this.settings.highWaterMark);
        }

        // Grab another reference to the pool in the case that while we're
        // in the thread pool another read() finishes up the pool, and
        // allocates a new one.
        const pool = this._pool;
        // Read the smaller of rest of the pool or however many bytes we want
        const toRead = Math.min(pool.length - pool.used, size);
        const start = pool.used;

        debug('_read', 'reading', toRead, 'from', start);
        this._port.read(pool, start, toRead, (error, bytesRead) => {
            if (error) {
                debug('binding.read', 'had an error', error.message);
            } else {
                debug('binding.read', 'finished');
                let chunk = pool.slice(start, start + bytesRead);
                this.push(chunk)
            }
        });
    }
}

module.exports = SerialPort;