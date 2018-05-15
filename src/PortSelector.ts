'use strict';

import { StatusBarAlignment, window, StatusBarItem, QuickPickItem } from 'vscode';
import { SerialPort, ISerialPortInfo } from './SerialPort';

class PortSelector {
    private _statusBarItem: StatusBarItem;
    private _port: ISerialPortInfo | null = null;

    constructor() {
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 1);
        this._statusBarItem.command = 'led_basic.serialports';
    }

    init(): Promise<ISerialPortInfo | null> {
        return new Promise((resolve) => {
            this.getPortList()
                .then((ports) => {
                    this._port = null;
                    if (ports.length === 1) {
                        this._port = ports[0];
                    }
                    this.update();
                    resolve(this._port);
                });
        })
    }

    selectedPort(): ISerialPortInfo | null {
        return this._port;
    }

    setPort(port: ISerialPortInfo | null) {
        this._port = port;
        this.update();
    }

    showSelection(): Promise<ISerialPortInfo | null> {
        return new Promise((resolve, reject) => {
            let foundPorts: ISerialPortInfo[];
            this.getPortList()
                .then((ports: ISerialPortInfo[]) => {
                    foundPorts = ports;
                    let options: QuickPickItem[] = ports.map((port: ISerialPortInfo) => {
                        return {
                            label: port.name,
                            detail: port.deviceName
                        }
                    })
                    return window.showQuickPick(options);
                })
                .then((selected: QuickPickItem | undefined) => {
                    this._port = null;
                    if (selected) {
                        let portInfo = foundPorts.find((port: ISerialPortInfo) => {
                            return port.name === selected.label;
                        });
                        if (portInfo) {
                            this._port = portInfo;
                        }
                    }
                    this.update();
                    resolve(this._port);
                });
        });
    }

    private update() {
        let editor = window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        let label = 'Select serial port';
        if (this._port) {
            label = this._port.name + ' (' + this._port.deviceName + ')';
        }
        this._statusBarItem.text = label;
        this._statusBarItem.show();
    }

    public getPortList(): Promise<ISerialPortInfo[]> {
        return new Promise((resolve, reject) => {
            SerialPort.list()
                .then(resolve)
                .catch(reject);
        });
    }

    dispose() {
        this._statusBarItem.dispose();
    }
}

export const portSelector = new PortSelector();