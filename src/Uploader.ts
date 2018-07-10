'use strict';

import { SerialPort } from "./SerialPort";
import { StatusBarItem, window, StatusBarAlignment } from "vscode";
import { portSelector } from "./PortSelector";
import { deviceSelector } from "./DeviceSelector";
//import { dump } from "./utils";

interface IDataPacket {
    cmd: CMD;
    data: Uint8Array;
}

const PROG_BAUD = 38400;

enum ProgMode {
    PROG_MODE_TERMINAL,
    PROG_MODE_BL
}

enum CMD {
    CMD_RESET = 0xF1,
    CMD_BOOT_INF0 = 0xF2,
    CMD_BIOS_INF0 = 0xF3,
    CMD_WRITE = 0xBA,
}

const DEBUG = false;

class Uploader {
    private _statusBarItem: StatusBarItem;
    private _port!: SerialPort;
    private _seqNr: number = 1;

    constructor() {
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
        this._statusBarItem.command = 'led_basic.upload';
        this._statusBarItem.text = '$(triangle-right) Upload';
        this._statusBarItem.show();
    }

    upload(file: Uint8Array): Promise<void> {
        let sbProg = false;
        this._seqNr = 1;
        return new Promise((resolve, reject) => {
            //console.log(dump(file));
            this.initPort()
                .then(isProg => {
                    DEBUG && console.log('[UPLOAD] opening port for upload. SB-PROG: ', isProg);
                    sbProg = isProg;
                    if (sbProg) {
                        return this.openProgUpload();
                    } else {
                        return this._port.openForUpload(true, false);
                    }
                })
                .then(() => {
                    let nrPackets = Math.trunc((file.length + 255) / 256);
                    let index = 0;
                    DEBUG && console.log('[UPLOAD] port opened. Sending total', nrPackets, 'packets');

                    var self = this;
                    var sendSinglePacket = (index: number) => {
                        let packet = {
                            cmd: CMD.CMD_WRITE,
                            data: new Uint8Array(256 + 4)
                        };
                        let offset = index * 256;

                        let dv = new DataView(packet.data.buffer);
                        dv.setUint32(0, index * 256, true);
                        packet.data.set(file.slice(offset, offset + 256), 4);

                        DEBUG && console.log('[UPLOAD] upload - sending packet:', index);
                        self.sendPacket(packet, sbProg)
                            .then(() => {
                                if (index < nrPackets - 1) {
                                    index++;
                                    sendSinglePacket(index);
                                } else {
                                    DEBUG && console.log('[UPLOAD] upload - last packet sent');
                                    if (!sbProg) {
                                        let rstPacket: IDataPacket = {
                                            cmd: CMD.CMD_RESET,
                                            data: new Uint8Array([0x01, 0x02])
                                        }
                                        DEBUG && console.log('[UPLOAD] upload - sending reset packet');
                                        this.sendPacket(rstPacket)
                                            .then(() => {
                                                DEBUG && console.log('[UPLOAD] all packets sent. closing port');
                                                return this._port.close();
                                            })
                                            .then(resolve)
                                            .catch(reject);
                                    } else {
                                        DEBUG && console.log('[UPLOAD] upload - SB-Prog reset device');
                                        this._port.close()
                                            .then(() => {
                                                return this.switchProgMode(ProgMode.PROG_MODE_BL, true, true);
                                            })
                                            .then(() => {
                                                DEBUG && console.log('[UPLOAD] upload - port closed. Switching to terminal mode');
                                                return this.switchProgMode(ProgMode.PROG_MODE_TERMINAL, true, false);
                                            })
                                            .then(resolve)
                                            .catch(reject);
                                    }
                                }
                            })
                            .catch(error => {
                                if (this._port && this._port.isOpen()) {
                                    this._port.close()
                                        .then(() => {
                                            reject(error);
                                        });
                                } else {
                                    reject(error);
                                }
                            });
                    };
                    sendSinglePacket(index);
                })
                .catch(error => {
                    if (this._port && this._port.isOpen()) {
                        this._port.close()
                            .then(() => {
                                reject(error);
                            });
                    } else {
                        reject(error);
                    }
                })
        });
    }

    private openProgUpload(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._port.openForUpload(false, true)
                .then(() => {
                    DEBUG && console.log('[UPLOAD] checkProgDevice - checking if any device connected to SB-PROG');
                    return this._port.write(new Uint8Array([0x7F]));
                })
                .then(() => {
                    return this._port.read();
                })
                .then(response => {
                    DEBUG && console.log('[UPLOAD] checkProgDevice - got response from SB-PROG. length:', response.byteLength);
                    let dv = new DataView(response.buffer);
                    if (dv.byteLength < 2) {
                        throw new Error('There is no connected device to SB-PROG');
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    private switchProgMode(mode: ProgMode, brk: boolean, dtr: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[UPLOAD] switchProgMode - enter');
            let baud = 0;
            if (mode === ProgMode.PROG_MODE_BL) {
                baud = 0x114472;
            } else if (mode === ProgMode.PROG_MODE_TERMINAL) {
                baud = 0x114470;
            }

            if (this._port && this._port.isOpen()) {
                DEBUG && console.log('[UPLOAD] switchProgMode - port exists and opened');
                reject(new Error('Cannot switch mode. Port is opened and probably in use'));
                return;
            }

            let selectedPort = portSelector.selectedPort();
            let selectedDevice = deviceSelector.selectedDevice();

            if (!selectedPort) {
                reject(new Error('Serial port not selected.'));
                return;
            }

            if (!selectedDevice) {
                reject(new Error('Target device not selected.'));
                return;
            }

            let port = new SerialPort(selectedPort.name, {
                baudRate: baud
            });

            port.openForUpload(brk, dtr)
                .then(() => {
                    DEBUG && console.log('[UPLOAD] switchProgMode - closing port');
                    return port.close();
                })
                .then(() => {
                    DEBUG && console.log('[UPLOAD] switchProgMode - port closed. resolving');
                    resolve();
                })
                .catch(error => {
                    DEBUG && console.log('[UPLOAD] switchProgMode - error detected: ' + error.message);
                    reject(error);
                });
        });
    }

    private getProgDeviceInfo(): Promise<any> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[UPLOAD] getProgDeviceInfo - enter');
            let selectedPort = portSelector.selectedPort();
            let selectedDevice = deviceSelector.selectedDevice();

            if (!selectedPort) {
                reject(new Error('Serial port not selected.'));
                return;
            }

            if (!selectedDevice) {
                reject(new Error('Target device not selected.'));
                return;
            }

            if (this._port && this._port.isOpen()) {
                reject(new Error('Error getting device info - port already opened'));
                return;
            }

            this._port = new SerialPort(selectedPort.name, {
                baudRate: PROG_BAUD,
                parity: 'even'
            });

            let sysCode = 0;
            this.openProgUpload()
                .then(() => {
                    let packet = {
                        cmd: CMD.CMD_BOOT_INF0,
                        data: new Uint8Array([])
                    };
                    DEBUG && console.log('[UPLOAD] getProgDeviceInfo - requesting BOOT info');
                    return this.sendPacket(packet, true);
                })
                .then(response => {
                    DEBUG && console.log('[UPLOAD] getProgDeviceInfo - got BOOT info');
                    //console.log(dump(response));
                    sysCode = new DataView(response.buffer).getUint32(8, true);
                    return this._port.close();
                })
                .then(() => {
                    DEBUG && console.log('[UPLOAD] getProgDeviceInfo - port closed, resolving');
                    resolve({
                        sysCode: sysCode
                    });
                })
                .catch(reject)
        });
    }

    private initPort(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[UPLOAD] initPort');
            let selectedPort = portSelector.selectedPort();
            let selectedDevice = deviceSelector.selectedDevice();

            if (!selectedPort) {
                reject(new Error('Serial port not selected.'));
                return;
            }

            if (!selectedDevice) {
                reject(new Error('Target device not selected.'));
                return;
            }

            if (this._port && this._port.isOpen()) {
                DEBUG && console.log('[UPLOAD] initPort - port exists and open, closing');
                reject(new Error('Cannot init port. Port is opened and probably in use'));
                return;
            }

            let serport = selectedPort.name;
            if (selectedPort.sysCode === 0x4470) {
                // PROG-SB, get the info about connected device
                this.switchProgMode(ProgMode.PROG_MODE_BL, true, false)
                    .then(() => {
                        return this.getProgDeviceInfo();
                    })
                    .then(deviceInfo => {
                        if (selectedDevice.meta.sysCode !== deviceInfo.sysCode) {
                            throw new Error('Selected device does not match the connected device.');
                        }
                        DEBUG && console.log('[UPLOAD] initPort - device match. Creating new port');
                        this._port = new SerialPort(serport, {
                            baudRate: PROG_BAUD,
                            parity: 'even'
                        });
                        DEBUG && console.log('[UPLOAD] initPort - resolving');
                        resolve(true);
                    })
                    .catch(error => {
                        DEBUG && console.log('[UPLOAD] initPort - error detected: ' + error.message);
                        if (this._port.isOpen()) {
                            this._port.close()
                                .then(() => {
                                    return this.switchProgMode(ProgMode.PROG_MODE_TERMINAL, true, false);
                                })
                                .then(() => {
                                    reject(error);
                                });
                        } else {
                            this.switchProgMode(ProgMode.PROG_MODE_TERMINAL, true, false)
                                .then(() => {
                                    reject(error);
                                });
                        }
                    });
            } else if (selectedDevice.meta.sysCode !== selectedPort.sysCode) {
                reject(new Error('Selected device does not match the connected device.'));
            } else {
                DEBUG && console.log('[UPLOAD] initPort - creating new port');
                this._port = new SerialPort(selectedPort.name, {
                    baudRate: 0x100000 + selectedDevice.meta.sysCode
                });
                resolve(false);
            }
        })
    }

    private sendPacket(packet: IDataPacket, sbProg?: boolean): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            let len = packet.data.length + 7,
                out = new Uint8Array(len),
                dv = new DataView(out.buffer),
                index = 0,
                crc = 0;

            dv.setUint8(index++, 0x1B);
            dv.setUint8(index++, this._seqNr);
            dv.setInt16(index, packet.data.length, true);
            index += 2;
            dv.setUint8(index++, packet.cmd);
            dv.setInt8(index++, 0x0E);
            // put data
            out.set(packet.data, index);
            index += packet.data.length;
            // calc crc
            for (let i = 0; i < out.length; i++) {
                crc ^= out[i];
            }
            dv.setInt8(index, crc);

            //console.log('REQUEST:\n' + dump(out));
            DEBUG && console.log('[UPLOAD] sendPacket (SB-PROG:', !!sbProg, ')');
            this._port.write(out)
                .then(() => {
                    DEBUG && console.log('[UPLOAD] sendPacket. Data written, reading repsonse');
                    return this._port.read(!!sbProg ? 300 : 0);
                })
                .then(response => {
                    var result, dv,
                        crc = 0;

                    //console.log('RESPONSE:\n' + dump(response));
                    DEBUG && console.log('[UPLOAD] sendPacket. Got response');
                    let offset = sbProg ? 7 + packet.data.length : 0;
                    DEBUG && console.log('[UPLOAD] sendPacket. Buffer length:', response.byteLength, ', offset:', offset);
                    dv = new DataView(response.buffer, offset);

                    if (dv.getUint8(0) !== 0x1B) {
                        throw new Error('Illegal response');
                    }
                    if (dv.getUint8(1) !== this._seqNr) {
                        throw new Error('Unexpected packet number');
                    }

                    if (dv.getUint8(5) !== 0x0E) {
                        throw new Error('Illegal response');
                    }

                    for (let i = offset; i < response.length - 1; i++) {
                        crc ^= response[i];
                    }

                    if (dv.getUint8(dv.byteLength - 1) !== crc) {
                        throw new Error('Wrong checksum');
                    }
                    this._seqNr++;
                    result = new Uint8Array(response.buffer.slice(6 + offset, -1));
                    resolve(result);
                })
                .catch(error => {
                    DEBUG && console.log('[UPLOAD] sendPacket. Error:', error.message);
                    reject(error);
                });
        });
    }

    dispose() {
        this._statusBarItem.dispose();
        if (this._port) {
            this._port.dispose();
        }
    }
}

export const uploader = new Uploader();