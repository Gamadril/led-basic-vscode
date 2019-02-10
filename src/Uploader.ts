'use strict';

import { IDevice, ISerialPortInfo, ISerialPortFactory, ISerialPort, IDevUploader } from "./Common";

interface IDataPacket {
    cmd: CMD;
    data: Uint8Array;
}

const PROG_BAUD = 38400;
const SBPROG_SYSCODE = 0x4470;
const ERROR_GET_TIMEOUT = 200;

enum CMD {
    CMD_RESET = 0xF1,
    CMD_BOOT_INF0 = 0xF2,
    CMD_BIOS_INF0 = 0xF3,
    CMD_WRITE = 0xBA,
}

const DEBUG = false;

export class Uploader {
    private _devUploader: IDevUploader;

    constructor(portInfo: ISerialPortInfo, device: IDevice, portFactory: ISerialPortFactory) {
        if (portInfo.sysCode === SBPROG_SYSCODE) {
            this._devUploader = new SBProgUploader(portInfo, device, portFactory);
        } else {
            this._devUploader = new DeviceUploader(portInfo, device, portFactory);
        }
    }

    upload(file: Uint8Array): Promise<string> {
        return new Promise((resolve, reject) => {
            this._devUploader.open()
                .then(() => this._devUploader.sendData(file))
                .then(() => this._devUploader.close())
                .then(() => this._devUploader.reset())
                .then(error => {
                    if (error) {
                        DEBUG && console.log('[UPLOAD] upload - received error from device');
                    }
                    if (this._devUploader.isOpen()) {
                        this._devUploader.close()
                            .then(() => {
                                resolve(error);
                            })
                    } else {
                        resolve(error);
                    }
                })
                .catch(reject);
        });
    }

    dispose() {
        this._devUploader.close();
    }
}

abstract class BaseDeviceUploader implements IDevUploader {
    protected _portFactory: ISerialPortFactory;
    protected _deviceInfo: IDevice;
    protected _portInfo: ISerialPortInfo;
    protected _port: ISerialPort | null;
    private _seqNr: number = 1;

    constructor(portInfo: ISerialPortInfo, device: IDevice, portFactory: ISerialPortFactory) {
        this._portFactory = portFactory;
        this._deviceInfo = device;
        this._portInfo = portInfo;
        this._port = null;
    }

    isOpen(): boolean {
        if (!this._port) {
            return false;
        }
        return this._port.isOpen();
    }

    abstract open(): Promise<void>;
    abstract reset(): Promise<string>;
    abstract read(timeout?: number): Promise<Uint8Array>;

    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._port || !this._port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this._port.close()
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    write(data: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._port || !this._port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this._port.write(data)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    private createPacketData(packet: IDataPacket, seqnr: number): Uint8Array {
        let len = packet.data.length + 7,
            data = new Uint8Array(len),
            dv = new DataView(data.buffer),
            index = 0,
            crc = 0;

        dv.setUint8(index++, 0x1B);
        dv.setUint8(index++, seqnr);
        dv.setInt16(index, packet.data.length, true);
        index += 2;
        dv.setUint8(index++, packet.cmd);
        dv.setInt8(index++, 0x0E);
        // put data
        data.set(packet.data, index);
        index += packet.data.length;
        // calc crc
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
        }
        dv.setInt8(index, crc);

        return data;
    }

    sendData(data: Uint8Array): Promise<void> {
        return new Promise(async (resolve, reject) => {
            let nrPackets = Math.trunc((data.length + 255) / 256);

            DEBUG && console.log('[UPLOAD] Sending total', nrPackets, 'packets');

            let packet = {
                cmd: CMD.CMD_WRITE,
                data: new Uint8Array(256 + 4)
            };

            for (let index = 0; index < nrPackets; index++) {
                let offset = index * 256;
                let dv = new DataView(packet.data.buffer);
                dv.setUint32(0, index * 256, true);
                packet.data.set(data.slice(offset, offset + 256), 4);

                DEBUG && console.log('[UPLOAD] Sending packet', index);
                try {
                    await this.sendPacket(packet);
                } catch (error) {
                    reject(error);
                }
                DEBUG && console.log('[UPLOAD] Sent packet', index);
            }

            resolve();
        });
    }

    protected async sendPacket(packet: IDataPacket): Promise<Uint8Array> {
        return new Promise<Uint8Array>((resolve, reject) => {
            DEBUG && console.log('[UPLOAD] sendPacket');

            let data = this.createPacketData(packet, this._seqNr);

            this.write(data)
                .then(() => {
                    DEBUG && console.log('[UPLOAD] sendPacket. Data written, reading response');
                    return this.read();
                })
                .then(response => {
                    var dv,
                        crc = 0;

                    DEBUG && console.log('[UPLOAD] sendPacket. Got response');
                    dv = new DataView(response.buffer);

                    if (dv.getUint8(0) !== 0x1B) {
                        throw new Error('Illegal response');
                    }
                    if (dv.getUint8(1) !== this._seqNr) {
                        throw new Error('Unexpected packet number');
                    }
                    if (dv.getUint8(5) !== 0x0E) {
                        throw new Error('Illegal response');
                    }

                    for (let i = 0; i < response.length - 1; i++) {
                        crc ^= response[i];
                    }

                    if (dv.getUint8(dv.byteLength - 1) !== crc) {
                        throw new Error('Wrong checksum');
                    }
                    this._seqNr++;

                    let data = response.slice(6, -1);
                    resolve(data);
                })
                .catch(error => {
                    DEBUG && console.log('[UPLOAD] sendPacket. Error:', error.message);
                    reject(error);
                });
        });
    }
}

class DeviceUploader extends BaseDeviceUploader {
    reset(): Promise<string> {
        return new Promise((resolve, reject) => {
            let error = '';
            let rstPacket = {
                cmd: CMD.CMD_RESET,
                data: new Uint8Array([0x01, 0x02])
            };

            DEBUG && console.log('[UPLOAD] resetDevice start');

            this.open()
                .then(() => this.sendPacket(rstPacket))
                .then(() => this.read(ERROR_GET_TIMEOUT)) // get a possible error
                .then(data => {
                    if (data.length) {
                        error = String.fromCharCode.apply(null, data);
                    }
                    return Promise.resolve();
                })
                .then(() => this.close())
                .then(() => {
                    DEBUG && console.log('[UPLOAD] resetDevice done');
                    resolve(error);
                })
                .catch(reject);
        });
    }

    read(timeout?: number): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            if (!this._port || !this._port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this._port.read(timeout)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    open(): Promise<void> {
        this._port = this._portFactory.createSerialPort(this._portInfo.name, {
            baudRate: 0x100000 + this._deviceInfo.meta.sysCode
        });
        return this._port.openForUpload(true, false);
    }
}

class SBProgUploader extends BaseDeviceUploader {
    reset(): Promise<string> {
        return new Promise((resolve, reject) => {
            let baud = 0x110000 + this._deviceInfo.meta.sysCode;

            let port = this._portFactory.createSerialPort(this._portInfo.name, {
                baudRate: baud + 2
            });

            port.openForUpload(true, true)
                .then(() => port.close())
                .then(() => {
                    DEBUG && console.log('[UPLOAD] reset - SB-Prog done');
                    port = this._portFactory.createSerialPort(this._portInfo.name, {
                        baudRate: baud
                    });
                    return port.openForUpload(true, false);
                })
                .then(() => port.close())
                .then(() => {
                    DEBUG && console.log('[UPLOAD] SB-Prog switched in terminal mode');
                    resolve('');
                })
                .catch(reject);
        });
    }

    read(timeout?: number): Promise<Uint8Array> {
        timeout = timeout || 200;

        return new Promise((resolve, reject) => {
            if (!this._port || !this._port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this._port.read(timeout)
                    .then(response => {
                        let dv = new DataView(response.buffer);
                        let requestLength = dv.getUint16(2, true);
                        let data = response.slice(7 + requestLength);
                        resolve(data);
                    })
                    .catch(reject);
            }
        });
    }

    open(): Promise<void> {
        return new Promise((resolve, reject) => {
            let baud = 0x110000 + this._deviceInfo.meta.sysCode + 2;

            let port = this._portFactory.createSerialPort(this._portInfo.name, {
                baudRate: baud
            });

            port.openForUpload(true, false)
                .then(() => port.close())
                .then(() => {
                    port = this._portFactory.createSerialPort(this._portInfo.name, {
                        baudRate: PROG_BAUD,
                        parity: 'even'
                    });
                    return port.openForUpload(false, true);
                })
                .then(() => {
                    return port.write(new Uint8Array([0x7F]));
                })
                .then(() => {
                    return port.read();
                })
                .then(response => {
                    if (response.length < 2) {
                        throw new Error('There is no connected device to SB-PROG');
                    }
                    let packet = {
                        cmd: CMD.CMD_BOOT_INF0,
                        data: new Uint8Array([])
                    };
                    this._port = port;
                    return this.sendPacket(packet);
                })
                .then((response) => {
                    let sysCode = String.fromCharCode.apply(null, response.slice(0, 4));
                    if (this._deviceInfo.meta.sysCode !== parseInt(sysCode, 16)) {
                        throw new Error('Selected device does not match the connected device.');
                    }
                    resolve();
                })
                .catch(error => {
                    if (port.isOpen()) {
                        port.close()
                            .then(() => {
                                reject(error);
                            })
                    } else {
                        reject(error);
                    }
                });
        });
    }
}