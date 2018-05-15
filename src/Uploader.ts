'use strict';

import { SerialPort } from "./SerialPort";
import { StatusBarItem, window, StatusBarAlignment } from "vscode";
import { portSelector } from "./PortSelector";
import { deviceSelector } from "./DeviceSelector";

interface IDataPacket {
    cmd: CMD;
    data: Uint8Array;
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

    upload(file: Uint8Array): Promise<null> {
        this._seqNr = 1;
        return new Promise((resolve, reject) => {
            //console.log(dump(file));
            this.initPort()
                .then(() => {
                    return this._port.openForUpload();
                })
                .then(() => {
                    let nrPackets = Math.trunc((file.length + 255) / 256);
                    let index = 0;

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

                        self.sendPacket(packet)
                            .then(() => {
                                if (index < nrPackets - 1) {
                                    index++;
                                    sendSinglePacket(index);
                                } else {
                                    let rstPacket: IDataPacket = {
                                        cmd: CMD.CMD_RESET,
                                        data: new Uint8Array([0x01, 0x02])
                                    }
                                    this.sendPacket(rstPacket)
                                        .then(() => {
                                            return this._port.close();
                                        })
                                        .then(resolve)
                                        .catch(reject);
                                }
                            })
                            .catch(error => {
                                if (this._port && this._port.isOpen()) {
                                    this._port.close();
                                }
                                reject(error)
                            });

                    };
                    sendSinglePacket(index);
                })
                .catch((err: Error) => {
                    if (this._port && this._port.isOpen()) {
                        this._port.close();
                    }
                    reject(err);
                })
        });
    }

    private initPort(): Promise<null> {
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

            if (selectedDevice.meta.sysCode !== selectedPort.sysCode) {
                reject(new Error('Selected device does not match the connected device.'));
                return;    
            }

            if (this._port && this._port.isOpen()) {
                DEBUG && console.log('[UPLOAD] initPort - port exists and open, closing');
                this._port.close();
            }

            DEBUG && console.log('[UPLOAD] initPort - creating new port');
            this._port = new SerialPort(selectedPort.name, {
                baudRate: 0x100000 + selectedDevice.meta.sysCode
            });
            resolve();
        })
    }

    private sendPacket(packet: IDataPacket): Promise<Uint8Array> {
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

            this._port.write(out)
                .then(() => {
                    return this._port.read();
                })
                .then((response: Uint8Array) => {
                    var result, dv,
                        crc = 0;

                    //console.log('RESPONSE:\n' + dump(response));
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

                    if (dv.getUint8(response.length - 1) !== crc) {
                        throw new Error('Wrong checksum');
                    }
                    this._seqNr++;
                    result = new Uint8Array(response.buffer.slice(6, -1));
                    resolve(result);
                })
                .catch((error: Error) => {
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