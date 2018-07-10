'use strict';
const fs = require('fs');

module.exports = function unixRead(buffer, offset, length) {
    if (!this.isOpen) {
        return Promise.reject(new Error('Port is not open'));
    }
    return new Promise((resolve, reject) => {
        fs.read(this.fd, buffer, offset, length, null, (err, bytesRead) => {
            if (err && (
                    err.code === 'EAGAIN' ||
                    err.code === 'EWOULDBLOCK' ||
                    err.code === 'EINTR'
                )) {
                if (!this.isOpen) {
                    return reject(new Error('Port is not open'));
                }
                this.poller.once('readable', (err) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve(this.read(buffer, offset, length));
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

            if (bytesRead === 0) {
                resolve(this.read(buffer, offset, length));
                return;
            }

            resolve(bytesRead);
        });
    });
};