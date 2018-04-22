'use strict';

import { StatusBarAlignment, window, StatusBarItem } from 'vscode';
import { Device } from './Device';

const CMD_LED_BASIC = ['setled', 'setall'];
const CMD_LED_PWM = ['show', 'lrgb', 'lhsv', 'irgb', 'ihsv', 'iled', 'iall', 'irange', 'rainbow', 'copy', 'repeat', 'shift', 'mirror', 'blackout'];
const CMD_LED_BRIGHT = ['bright'];
const CMD_IO_KEY = ['waitkey', 'getkey', 'keystate'];
const CMD_IO_RTC = ['getrtc', 'setrtc'];
const CMD_IO_LDR = ['getldr'];
const CMD_IO_IR = ['getir'];
const CMD_IO_PORT = ['setport', 'clrport'];
const CMD_IO_POTI = ['getpoti'];
const CMD_IO_TEMP = ['gettemp'];
const CMD_IO_XTEMP = ['xtempcnt', 'xtempval'];
const CMD_IO_SOUND = ['beep'];
const CMD_IO_ENC = ['getenc', 'setenc'];
const CMD_IO_EEP = ['eeread', 'eewrite'];
const CMD_LED_SEG = ['clear', 'pchar', 'achar', 'praw', 'araw', 'adp', 'phex', 'pdez'];

const DEVICES: Device[] = [
    {
        label: 'LED-Badge (12)',
        detail: 'Cell coin powered badge with 12 RGB-LEDs without PWM',
        sysCode: '3110',
        commands: CMD_LED_BASIC
    },
    {
        label: 'LED-Badge (16)',
        detail: 'Cell coin powered badge with a button and 16 RGB-LEDs without PWM',
        sysCode: '3120',
        commands: CMD_LED_BASIC.concat(CMD_IO_KEY)
    },
    {
        label: 'Basic-Pentagon',
        detail: 'Supports PWM LEDs, DS18B20 temp. sensor, RTC, LDR. 3 buttons on board.',
        sysCode: '3130',
        commands: CMD_LED_PWM.concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_IR).concat(CMD_IO_PORT).concat(CMD_IO_TEMP)
    },
    {
        label: 'Basic-Budget',
        detail: 'Supports PWM LEDs, DS18B20 temp. sensor, RTC, LDR, buttons',
        sysCode: '3130',
        commands: CMD_LED_PWM.concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_IR).concat(CMD_IO_PORT).concat(CMD_IO_TEMP)
    },
    {
        label: 'Cronios 1',
        detail: 'Basis module for LED clocks',
        sysCode: '3140',
        commands: CMD_LED_PWM.concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_SOUND).concat(CMD_IO_ENC).concat(CMD_IO_EEP)
    },
    {
        label: 'Cronios-Segmenta',
        detail: 'Clock module based on 7-segment digits',
        sysCode: '3150',
        commands: CMD_LED_PWM.concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_PORT).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP)
    },
    {
        label: 'Basic-Booster',
        detail: 'Compact module for PWM LEDs',
        sysCode: '3160',
        commands: CMD_LED_PWM.concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_IR).concat(CMD_IO_SOUND)
    },
    {
        label: 'Cortex-Clock',
        detail: 'Single color 4 digits display.',
        sysCode: '3170',
        commands: CMD_LED_SEG.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_SOUND).concat(CMD_IO_EEP)
    },
    {
        label: 'Temperature Sensor interface',
        detail: 'Supports up to 8 DS18B20 temp sensors.',
        sysCode: '3180',
        commands: CMD_IO_XTEMP.concat(CMD_IO_PORT).concat(CMD_IO_SOUND)
    },
    {
        label: 'Lightbar interface',
        detail: 'Supports up to 16 single color LEDs.',
        sysCode: '3190',
        commands: CMD_LED_BASIC.concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_POTI)
    },
    {
        label: 'All-In-One Power-M4-Board',
        detail: 'Powerfull board with many supported features',
        sysCode: '3210',
        commands: CMD_LED_PWM.concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_IR).concat(CMD_IO_ENC).concat(CMD_IO_PORT).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP)
    }
];

export class DeviceSelector {
    private _statusBarItem: StatusBarItem;
    private _device: Device = DEVICES[0];

    constructor() {
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
        this._statusBarItem.command = 'extension.device';
        this.update();
    }

    public selectedDevice() {
        return this._device;
    }

    public showSelection(): Thenable<Device> {
        return new Promise((resolve, reject) => {
            window.showQuickPick(DEVICES)
                .then((device) => {
                    if (device) {
                        this._device = device;
                        this.update();
                        resolve(device);
                    }
                });
        });
    }

    public update() {
        let editor = window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        // Only update status if an Markdown file
        if (editor.document.languageId !== "led_basic") {
            this._statusBarItem.hide();
        } else {
            this._statusBarItem.text = this._device.label;
            this._statusBarItem.show();
        }
    }

    dispose() {
        this._statusBarItem.dispose();
    }
}