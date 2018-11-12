'use strict';

import { SerialPort } from "./SerialPort";
import { portSelector } from "./PortSelector";
import { StatusBarItem, window, StatusBarAlignment, TerminalRenderer } from "vscode";

/**
 * Terminal state
 */
export enum TERM_STATE {
    CONNECTED,
    DISCONNECTED,
    DISABLED
};

const TERMINAL_NAME = 'LED Basic Terminal';
const REG_ERROR = new RegExp('\\?ERROR ([0-9]+) IN LINE ([0-9]+)');

const ERROR_MAP: { [s: string]: string; } = {
    '11': 'Unknown token',
    '12': 'Wrong address',
    '13': 'Too many nested GOSUB commands',
    '14': 'RETURN wihtout GOSUB',
    '15': 'Value cannot be 0',
    '16': 'Too many nested FOR-NEXT loops',
    '17': 'Incorrect values at TO/DOWNTO',
    '18': 'Next variable is invalid',
    '19': 'Wrong value in LED command',
    '20': 'Wrong value in IO command'
};

class Terminal {
    private _state: TERM_STATE = TERM_STATE.DISABLED;
    private _statusBarItem: StatusBarItem;
    private _port: SerialPort | null = null;
    private _shell: TerminalRenderer | null = null;

    constructor() {
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 2);
        this._statusBarItem.command = 'led_basic.terminal';
        this._statusBarItem.show();
        this.update();

        window.onDidCloseTerminal((terminal) => {
            if (terminal.name === TERMINAL_NAME) {
                this.stop();
            }
        });
    }

    start(): Promise<void> {
        if (this._state === TERM_STATE.DISABLED) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            if (this._port && this._port.isOpen()) {
                resolve();
                return;
            }

            let selectedPort = portSelector.selectedPort();
            if (!selectedPort) {
                reject(new Error('Serial port not selected.'));
                return;
            }
            let deviceName = selectedPort.deviceName;

            this._port = new SerialPort(selectedPort.name);
            this._port.open()
                .then(() => {
                    debugger;
                    if (this._shell === null) {
                        this._shell = window.createTerminalRenderer(TERMINAL_NAME);
                    }

                    this._shell.write('\x1b[32mConnected to LED Basic device: \x1b[36m' + deviceName + '\x1b[0m\r\n\r\n');
                    this._shell.terminal.show();

                    if (this._port) {
                        this._port.setReadListener(data => {
                            if (!this._shell) {
                                return;
                            }

                            let msg = String.fromCharCode.apply(null, data);
                            if (msg.startsWith('?ERROR')) {
                                this._shell.write('\x1b[31m' + msg + '\x1b[0m');

                                let match = REG_ERROR.exec(msg);
                                if (match) {
                                    let err = ERROR_MAP[match[1]];
                                    if (err) {
                                        window.showErrorMessage(err + ' in line ' + match[2]);
                                    }
                                }
                            } else {
                                this._shell.write(msg);
                            }
                            this._shell.write('\r\n');
                        });
                    }
                    this._state = TERM_STATE.CONNECTED;
                    this.update();
                    resolve();
                })
                .catch(reject);
        });
    }

    stop(): Promise<void> {
        if (!this._port || !this._port.isOpen() || this._state !== TERM_STATE.CONNECTED) {
            return Promise.resolve();
        } else {
            if (this._shell) {
                this._shell.terminal.dispose();
                this._shell = null;
            }
            this._state = TERM_STATE.DISCONNECTED;
            this.update();
            return this._port.close();
        }
    }

    get state(): TERM_STATE {
        return this._state;
    }

    enable() {
        this._state = TERM_STATE.DISCONNECTED;
        this.update();
    }

    disable() {
        this._state = TERM_STATE.DISABLED;
        this.update();
    }

    private update() {
        let label = 'Terminal';

        if (this._state === TERM_STATE.CONNECTED) {
            label = '$(link) ' + label;
        } else if (this._state === TERM_STATE.DISCONNECTED) {
            label = '$(zap) ' + label;
        } else {
            label = '$(circle-slash) ' + label;
        }

        this._statusBarItem.text = label;
    }

    dispose() {
        this._statusBarItem.dispose();
    }
}

export const terminal = new Terminal();