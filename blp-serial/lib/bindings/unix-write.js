'use strict';
const fs = require('fs');

module.exports = function unixWrite(buffer, offset) {
    offset = offset || 0;
    const bytesToWrite = buffer.length - offset;
    if (!this.isOpen) {
        return Promise.reject(new Error('Port is not open'));
    }
    return new Promise((resolve, reject) => {
        fs.write(this.fd, buffer, offset, bytesToWrite, (err, bytesWritten) => {
            if (err && (
                    err.code === 'EAGAIN' ||
                    err.code === 'EWOULDBLOCK' ||
                    err.code === 'EINTR'
                )) {
                if (!this.isOpen) {
                    return reject(new Error('Port is not open'));
                }
                this.poller.once('writable', (err) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve(unixWrite.call(this, buffer, offset));
                });
                return;
            }

            const disconnectError = err && (
                err.code === 'EBADF' || // Bad file number means we got closed
                err.code === 'ENXIO' || // No such device or address probably usb disconnect
                err.code === 'UNKNOWN' ||
                err.errno === -1 // generic error
            );

            if (disconnectError) {
                err.disconnect = true;
            }

            if (err) {
                return reject(err);
            }

            if (bytesWritten + offset < buffer.length) {
                if (!this.isOpen) {
                    return reject(new Error('Port is not open'));
                }
                return resolve(unixWrite.call(this, buffer, bytesWritten + offset));
            }

            resolve();
        });
    });
};