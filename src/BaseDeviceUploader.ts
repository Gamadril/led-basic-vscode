'use strict';
// tslint:disable: no-console no-bitwise no-unused-expression

import { IDevice, IDevUploader, ISerialPort, ISerialPortFactory, ISerialPortInfo } from './Common';

const DEBUG = false;

interface IDataPacket {
    cmd: CMD;
    data: Uint8Array;
}

export enum CMD {
    CMD_RESET = 0xF1,
    CMD_BOOT_INF0 = 0xF2,
    CMD_BIOS_INF0 = 0xF3,
    CMD_WRITE = 0xBA,
}

export abstract class BaseDeviceUploader implements IDevUploader {
    protected portFactory: ISerialPortFactory;
    protected deviceInfo: IDevice;
    protected portInfo: ISerialPortInfo;
    protected port: ISerialPort | null;
    private seqNr: number = 1;

    constructor(portInfo: ISerialPortInfo, device: IDevice, portFactory: ISerialPortFactory) {
        this.portFactory = portFactory;
        this.deviceInfo = device;
        this.portInfo = portInfo;
        this.port = null;
    }

    public isOpen(): boolean {
        if (!this.port) {
            return false;
        }
        return this.port.isOpen();
    }

    public abstract open(): Promise<void>;
    public abstract reset(): Promise<string>;
    public abstract read(timeout?: number): Promise<Uint8Array>;

    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.port || !this.port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this.port.close()
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    public write(data: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.port || !this.port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this.port.write(data)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    public sendData(data: Uint8Array): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const nrPackets = Math.trunc((data.length + 255) / 256);

            DEBUG && console.log('[UPLOAD] Sending total', nrPackets, 'packets');

            const packet = {
                cmd: CMD.CMD_WRITE,
                data: new Uint8Array(256 + 4)
            };

            for (let index = 0; index < nrPackets; index++) {
                const offset = index * 256;
                const dv = new DataView(packet.data.buffer);
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

            const data = this.createPacketData(packet, this.seqNr);

            this.write(data)
                .then(() => {
                    DEBUG && console.log('[UPLOAD] sendPacket. Data written, reading response');
                    return this.read();
                })
                .then((response: Uint8Array) => {
                    let dv;
                    let crc = 0;

                    DEBUG && console.log('[UPLOAD] sendPacket. Got response');
                    dv = new DataView(response.buffer);

                    if (dv.getUint8(0) !== 0x1B) {
                        throw new Error('Illegal response');
                    }
                    if (dv.getUint8(1) !== this.seqNr) {
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
                    this.seqNr++;

                    resolve(response.slice(6, -1));
                })
                .catch((error: Error) => {
                    DEBUG && console.log('[UPLOAD] sendPacket. Error:', error.message);
                    reject(error);
                });
        });
    }

    private createPacketData(packet: IDataPacket, seqnr: number): Uint8Array {
        const len = packet.data.length + 7;
        const data = new Uint8Array(len);
        const dv = new DataView(data.buffer);
        let index = 0;
        let crc = 0;

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
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
        }
        dv.setInt8(index, crc);

        return data;
    }
}
