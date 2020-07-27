'use strict';

import { StringDecoder } from 'string_decoder';
import { OutputChannel, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { portSelector } from './PortSelector';
import { SerialPort } from './SerialPort';

/**
 * Terminal state
 */
export enum TERM_STATE {
    CONNECTED,
    DISCONNECTED,
    DISABLED
}

class Terminal {
    public state: TERM_STATE = TERM_STATE.DISABLED;
    private channel: OutputChannel;
    private statusBarItem: StatusBarItem;
    private port: SerialPort | null = null;
    private deviceName: string;

    constructor() {
        this.channel = window.createOutputChannel('BLP-Device-Output');
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 2);
        this.statusBarItem.command = 'led_basic.terminal';
        this.statusBarItem.show();
        this.deviceName = '';
        this.update();
    }

    public start(): Promise<void> {
        if (this.state === TERM_STATE.DISABLED) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            if (this.port && this.port.isOpen()) {
                resolve();
                return;
            }
            const selectedPort = portSelector.selectedPort();
            if (!selectedPort) {
                reject(new Error('Serial port not selected.'));
                return;
            }
            this.deviceName = selectedPort.deviceName;

            this.port = new SerialPort(selectedPort.name, {
                baudRate: 115200
            });
            this.port.open()
                .then(() => {
                    this.addLine('> Connected to LED Basic device: ' + this.deviceName);

                    if (this.port) {
                        this.port.setReadListener((data: Uint8Array) => {
                            // const msg = String.fromCharCode.apply(null, data);
                            const msg = new StringDecoder('utf8').write(Buffer.from(data));
                            if (msg.startsWith('?ERROR')) {
                                this.addLine(msg);
                            } else {
                                this.addLine(msg);
                            }
                        });
                    }
                    this.state = TERM_STATE.CONNECTED;
                    this.update();
                    this.port?.write(new Uint8Array([0]));
                    resolve();
                })
                .catch(reject);
        });
    }

    public stop(): Promise<void> {
        if (!this.port || !this.port.isOpen() || this.state !== TERM_STATE.CONNECTED) {
            return Promise.resolve();
        } else {
            this.state = TERM_STATE.DISCONNECTED;
            this.update();
            this.addLine('> Disconnected from ' + this.deviceName);
            return this.port.close();
        }
    }

    public enable() {
        this.state = TERM_STATE.DISCONNECTED;
        this.update();
    }

    public disable() {
        this.state = TERM_STATE.DISABLED;
        this.update();
    }

    public dispose() {
        this.statusBarItem.dispose();
        this.channel.dispose();
    }

    private addLine(message: string) {
        this.channel.show();
        this.channel.appendLine(message);
    }

    private update() {
        let label = 'Terminal';

        if (this.state === TERM_STATE.CONNECTED) {
            label = '$(link) ' + label;
        } else if (this.state === TERM_STATE.DISCONNECTED) {
            label = '$(zap) ' + label;
        } else {
            label = '$(circle-slash) ' + label;
        }

        this.statusBarItem.text = label;
    }
}

export const terminal = new Terminal();
