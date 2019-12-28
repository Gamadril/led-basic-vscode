'use strict';

import { QuickPickItem, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { ISerialPortInfo } from './Common';
import { SerialPort } from './SerialPort';

class PortSelector {
    private statusBarItem: StatusBarItem;
    private port: ISerialPortInfo | null = null;

    constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 1);
        this.statusBarItem.command = 'led_basic.serialports';
    }

    public init(): Promise<ISerialPortInfo | null> {
        return new Promise((resolve) => {
            this.getPortList()
                .then((ports) => {
                    this.port = null;
                    if (ports.length === 1) {
                        this.port = ports[0];
                    }
                    this.update();
                    resolve(this.port);
                });
        });
    }

    public selectedPort(): ISerialPortInfo | null {
        return this.port;
    }

    public setPort(port: ISerialPortInfo | null) {
        this.port = port;
        this.update();
    }

    public showSelection(): Promise<ISerialPortInfo | null> {
        return new Promise((resolve, reject) => {
            let foundPorts: ISerialPortInfo[];
            this.getPortList()
                .then((ports: ISerialPortInfo[]) => {
                    foundPorts = ports;
                    const options: QuickPickItem[] = ports.map((port: ISerialPortInfo) => {
                        return {
                            label: port.name,
                            detail: port.deviceName
                        };
                    });
                    return window.showQuickPick(options);
                })
                .then((selected: QuickPickItem | undefined) => {
                    this.port = null;
                    if (selected) {
                        const portInfo = foundPorts.find((port: ISerialPortInfo) => {
                            return port.name === selected.label;
                        });
                        if (portInfo) {
                            this.port = portInfo;
                        }
                    }
                    this.update();
                    resolve(this.port);
                });
        });
    }

    public getPortList(): Promise<ISerialPortInfo[]> {
        return new Promise((resolve, reject) => {
            SerialPort.list()
                .then(resolve)
                .catch(reject);
        });
    }

    public dispose() {
        this.statusBarItem.dispose();
    }

    private update() {
        const editor = window.activeTextEditor;
        if (!editor) {
            this.statusBarItem.hide();
            return;
        }

        let label = 'Select serial port';
        if (this.port) {
            label = this.port.name + ' (' + this.port.deviceName + ')';
        }
        this.statusBarItem.text = label;
        this.statusBarItem.show();
    }
}

export const portSelector = new PortSelector();
