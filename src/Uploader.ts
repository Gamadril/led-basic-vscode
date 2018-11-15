'use strict';

import { IParseResult, IConfig, COLOUR_ORDER, IDevice, ISerialPortInfo, ISerialPortFactory, ISerialPort } from "./Common";
import { dump } from "./utils";

interface IDataPacket {
    cmd: CMD;
    data: Uint8Array;
}

const LBO_HEADER_SIZE = 16;
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

export class Uploader {
    private _portInfo: ISerialPortInfo;
    private _device: IDevice;
    private _seqNr: number = 1;
    private _portFactory: ISerialPortFactory;
    private _port!: ISerialPort;

    constructor(portInfo: ISerialPortInfo, device: IDevice, portFactory: ISerialPortFactory) {
        this._portInfo = portInfo;
        this._device = device;
        this._portFactory = portFactory;
    }

    upload(file: Uint8Array | IParseResult): Promise<void> {
        let sbProg = false;
        this._seqNr = 1;
        let out_file: Uint8Array;

        if (file instanceof Uint8Array) {
            out_file = file;
        } else {
            out_file = new Uint8Array(file.code.length + LBO_HEADER_SIZE);
            let header = this.createLboHeader(file.config, file.code.length);
            out_file.set(header, 0);
            out_file.set(file.code, LBO_HEADER_SIZE);
        }

        return new Promise((resolve, reject) => {
            console.log(dump(out_file));
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
                    let nrPackets = Math.trunc((out_file.length + 255) / 256);
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
                        packet.data.set(out_file.slice(offset, offset + 256), 4);

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

            let port = this._portFactory.createSerialPort(this._portInfo.name, {
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
                .catch((error: any) => {
                    DEBUG && console.log('[UPLOAD] switchProgMode - error detected: ' + error.message);
                    reject(error);
                });
        });
    }

    private getProgDeviceInfo(): Promise<any> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[UPLOAD] getProgDeviceInfo - enter');

            if (this._port && this._port.isOpen()) {
                reject(new Error('Error getting device info - port already opened'));
                return;
            }

            this._port = this._portFactory.createSerialPort(this._portInfo.name, {
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

            if (this._port && this._port.isOpen()) {
                DEBUG && console.log('[UPLOAD] initPort - port exists and open, closing');
                reject(new Error('Cannot init port. Port is opened and probably in use'));
                return;
            }

            if (this._portInfo.sysCode === 0x4470) {
                // PROG-SB, get the info about connected device
                this.switchProgMode(ProgMode.PROG_MODE_BL, true, false)
                    .then(() => {
                        return this.getProgDeviceInfo();
                    })
                    .then(deviceInfo => {
                        if (this._device.meta.sysCode !== deviceInfo.sysCode) {
                            throw new Error('Selected device does not match the connected device.');
                        }
                        DEBUG && console.log('[UPLOAD] initPort - device match. Creating new port');
                        this._port = this._portFactory.createSerialPort(this._portInfo.name, {
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
            } else if (this._device.meta.sysCode !== this._portInfo.sysCode) {
                reject(new Error('Selected device does not match the connected device.'));
            } else {
                DEBUG && console.log('[UPLOAD] initPort - creating new port');
                this._port = this._portFactory.createSerialPort(this._portInfo.name, {
                    baudRate: 0x100000 + this._device.meta.sysCode
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

    private createLboHeader(config: IConfig, codeLength: number): Uint8Array {
        var meta = this._device.meta;
        var header = new Uint8Array(LBO_HEADER_SIZE);
        var dv = new DataView(header.buffer);

        // set the sys code of the currently selected device
        dv.setUint16(0, meta.sysCode, true);
        // set the size of the LBO header
        dv.setUint8(2, LBO_HEADER_SIZE);
        // set the LED-Basic version
        dv.setUint8(3, meta.basver || 0x0F);
        // set the size of the code
        dv.setUint16(4, codeLength, true);
        // set the max number of LEDs. If a device has a fixed number of LEDs - use
        // this value, otherwise check the config line from the code or finally a default value
        let ledcnt: number;
        if (meta.ledcnt !== undefined) {
            ledcnt = meta.ledcnt;
        } else if (config.ledcnt !== undefined) {
            ledcnt = config.ledcnt;
        } else if (meta.default_ledcnt !== undefined) {
            ledcnt = meta.default_ledcnt;
        } else {
            ledcnt = 255;
        }
        dv.setUint16(6, ledcnt, true);
        // set the colour order
        dv.setUint8(8, meta.colour_order || config.colour_order || COLOUR_ORDER.GRB); // colour order RGB / GRB
        // calculate and set cfg bits
        var cfg = 0x00;
        if (config.gprint === true || config.gprint === undefined) {
            cfg |= 0x02;
        }
        if (config.white) {
            cfg |= 0x01;
        }
        if (config.sys_led === undefined) {
            config.sys_led = 3;
        }
        if (config.sys_led) {
            cfg |= (config.sys_led << 2);
        }
        dv.setUint8(9, meta.cfg || cfg);
        // set the frame rate
        dv.setUint8(10, config.frame_rate || 25);
        // set the master brightness
        dv.setUint8(11, meta.mbr || config.mbr || 100);
        // set the led type specific to the device
        dv.setUint8(12, meta.led_type || config.led_type || 0);
        // set the SPI rate for the APA102 compatible LEDs
        dv.setUint8(13, meta.spi_rate || config.spi_rate || 4);

        return header;
    }

    dispose() {
        if (this._port) {
            this._port.dispose();
        }
    }
}