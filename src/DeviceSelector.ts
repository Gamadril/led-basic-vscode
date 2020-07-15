'use strict';

import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { ICommand } from './Common';
import { Device } from './Device';

const CMD_LED_BASIC = [dev('setled', 2), dev('setall', 1)];
const CMD_LED_PWM = [dev('show'), dev('lrgb', 4), dev('lhsv', 4), dev('irgb', 4), dev('ihsv', 4), dev('iled', 2), dev('iall', 1), dev('irange', 3), dev('rainbow', 6), dev('copy', 2), dev('repeat', 3), dev('shift', 3), dev('mirror', 3), dev('blackout')];
const CMD_LED_BRIGHT = [dev('bright', 1)];
const CMD_IO_KEY = [dev('waitkey'), dev('getkey'), dev('keystate')];
const CMD_IO_RTC = [dev('getrtc', 1), dev('setrtc', 2)];
const CMD_IO_LDR = [dev('getldr')];
const CMD_IO_IR = [dev('getir')];
const CMD_IO_PORT_CLR = [dev('clrport', 1)];
const CMD_IO_PORT = CMD_IO_PORT_CLR.concat([dev('setport', 1)]);
const CMD_IO_POTI = [dev('getpoti', 1)];
const CMD_IO_ADC = [dev('getadc', 1)];
const CMD_IO_TEMP = [dev('gettemp')];
const CMD_IO_XTEMP = [dev('xtempcnt'), dev('xtempval', 2)];
const CMD_IO_SOUND = [dev('beep', 1)];
const CMD_IO_ENC = [dev('getenc'), dev('setenc', 3)];
const CMD_IO_EEP = [dev('eeread', 1), dev('eewrite', 2)];
const CMD_IO_SYS = [dev('sys', 2)];
const CMD_IO_BT = [dev('bt', 2)];
const CMD_LED_UPDATE = [dev('update')];
const CMD_LED_SEG = [dev('clear'), dev('pchar', 2), dev('achar', 4), dev('praw', 2), dev('araw', 4), dev('adp', 1), dev('phex', 3), dev('pdez', 4)].concat(CMD_LED_UPDATE);
const CMD_MATRIX = [dev('setxy', 3), dev('line', 5), dev('rect', 6), dev('circle', 5), dev('shift', 2), dev('setfont', 1), dev('char', 4), dev('pic', 2)];

/**
 * List of known/supported devices
 */
const DEVICES: Device[] = [
    {
        label: 'LED-Badge (12 LEDs)',
        detail: 'Cell coin powered badge with 12 RGB-LEDs without PWM.',
        commands: CMD_LED_BASIC,
        meta: {
            sysCode: 0x3110,
            ledcnt: 12,
            needsSbProg: true,
            noPrint: true
        }
    },
    {
        label: 'LED-Badge (16 LEDs)',
        detail: 'Cell coin powered badge with a button and 16 RGB-LEDs without PWM.',
        commands: CMD_LED_BASIC.concat(CMD_IO_KEY).concat(CMD_IO_PORT_CLR),
        meta: {
            sysCode: 0x3120,
            ledcnt: 16,
            needsSbProg: true
        }
    },
    {
        label: 'Basic-Pentagon-Board',
        detail: 'Supports PWM LEDs, DS18B20 temp. sensor, RTC, LDR. 3 buttons on board.',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_IR).concat(CMD_IO_PORT).concat(CMD_IO_TEMP),
        meta: {
            sysCode: 0x3130
        }
    },
    {
        label: 'Basic-Budget-Board',
        detail: 'Supports PWM LEDs, DS18B20 temp. sensor, RTC, LDR, buttons',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_IR).concat(CMD_IO_PORT).concat(CMD_IO_TEMP),
        meta: {
            sysCode: 0x3130
        }
    },
    {
        label: 'Cronios 1',
        detail: 'Basis module for LED clocks',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_SOUND).concat(CMD_IO_ENC).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3140
        }
    },
    {
        label: 'Cronios-Segmenta',
        detail: 'Clock module based on 7-segment digits',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_PORT).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP),
        meta: {
            sysCode: 0x3150
        }
    },
    {
        label: 'Basic-Booster',
        detail: 'Compact module for WS2812 compatible LEDs',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_IR),
        meta: {
            sysCode: 0x3160,
            needsSbProg: true
        }
    },
    {
        label: 'Cortex-Clock',
        detail: 'Single colour 4 digits display.',
        commands: CMD_LED_SEG.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_SOUND).concat(CMD_IO_EEP),
        meta: {
            sysCode: 0x3170,
            ledcnt: 0
        }
    },
    {
        label: 'Temperature-Sensor Interface',
        detail: 'Supports up to 8 DS18B20 temp sensors.',
        commands: CMD_IO_XTEMP.concat(CMD_IO_PORT),
        meta: {
            sysCode: 0x3180,
            ledcnt: 0
        }
    },
    {
        label: 'Running Light with 16 LEDs',
        detail: 'Supports up to 16 single colour LEDs.',
        commands: CMD_LED_BASIC.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_POTI).concat(CMD_IO_EEP),
        meta: {
            sysCode: 0x3190,
            default_ledcnt: 16,
            needsSbProg: true
        }
    },
    {
        label: 'All-In-One Power-M4-Board',
        detail: 'Powerfull board with many supported features.',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_IR).concat(CMD_IO_ENC).concat(CMD_IO_PORT).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP),
        meta: {
            sysCode: 0x3210,
            default_ledcnt: 1024,
            spi_rate: 0x04
        }
    },
    {
        label: 'LED-Box',
        detail: 'Ready to use package with controller, IR RC and LED stripe.',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_LDR).concat(CMD_IO_IR).concat(CMD_IO_PORT).concat(CMD_IO_EEP),
        meta: {
            sysCode: 0x3220
        }
    },
    {
        label: 'APA Booster',
        detail: 'Compact module for APA102 comaptible LEDs.',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT),
        meta: {
            sysCode: 0x3230,
            needsSbProg: true
        }
    },
    {
        label: 'RC-Box',
        detail: 'Module with RF remote control support.',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_ADC).concat(CMD_IO_IR).concat(CMD_IO_EEP),
        meta: {
            sysCode: 0x3240
        }
    },
    {
        label: 'Touch-Lamp',
        detail: 'Baseboard for a LED lamp.',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_IR).concat(CMD_IO_EEP),
        meta: {
            sysCode: 0x3270,
            ledcnt: 8
        }
    },
    {
        label: 'LED-Tube-Clock',
        detail: '8-digit clock with 7-segment LED displays in VFD tube design.',
        commands: CMD_LED_SEG.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_SOUND).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3300,
            ledcnt: 0
        }
    },
    {
        label: 'NixieCron - Cronios 2',
        detail: 'Imporved basis module for LED clocks',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_SOUND).concat(CMD_IO_ENC).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3350
        }
    },
    {
        label: 'NixieCron - Cronios 3',
        detail: 'Imporved basis module for LED clocks playing own sound files',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_SOUND).concat(CMD_IO_ENC).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3400
        }
    },
    {
        label: 'NixieCron - LED-Nixie-M4',
        detail: 'LED clock module with support of 4 digits',
        commands: CMD_LED_PWM.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_SOUND).concat(CMD_IO_ENC).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3320
        }
    },
    {
        label: 'NixiCron - LED-Tube-Clock',
        detail: '8-digit clock with 7-segment LED displays in VFD tube design with integrated DS3231',
        commands: CMD_LED_SEG.concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_SOUND).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3300,
            ledcnt: 0
        }
    },
    {
        label: 'NixieCron - Flame-Clock',
        detail: 'LED-Matrix-Display for displaying a flame, time etc.',
        commands: CMD_LED_BASIC.concat(CMD_MATRIX).concat(CMD_LED_UPDATE).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_SOUND).concat(CMD_IO_LDR).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3390
        }
    },
    {
        label: 'NixieCron - Matrix- and Segment-Tube-Clock',
        detail: 'LED-Matrix-Display for displaying a flame, time etc.',
        commands: CMD_LED_PWM.concat(CMD_MATRIX).concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_SOUND).concat(CMD_IO_LDR).concat(CMD_IO_ENC).concat(CMD_IO_EEP).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3410
        }
    },
    {
        label: 'LED-BASIC-PICO',
        detail: 'Tiny breadboard friendly base module',
        commands: CMD_LED_PWM.concat(CMD_LED_SEG).concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_ADC).concat(CMD_IO_IR).concat(CMD_IO_ENC).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP).concat(CMD_IO_RTC).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3370,
            ledcnt: 64
        }
    },
    {
        label: 'Chronios-Bluetooth',
        detail: 'Chronios clock module with Bluetooth support',
        commands: CMD_LED_PWM.concat(CMD_IO_KEY).concat(CMD_IO_RTC).concat(CMD_IO_LDR).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP).concat(CMD_IO_SYS).concat(CMD_IO_BT),
        meta: {
            sysCode: 0x3420
        }
    },
    /*
    {
        label: 'LED-BASIC-PICO2',
        detail: 'Improved version of the PICO base module',
        commands: CMD_LED_PWM.concat(CMD_LED_SEG).concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_ADC).concat(CMD_IO_IR).concat(CMD_IO_ENC).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP).concat(CMD_IO_RTC).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3430,
            ledcnt: 512
        }
    },
    {
        label: 'PICO2 Running Light',
        detail: 'RGB running light module based on PICO2',
        commands: CMD_LED_PWM.concat(CMD_LED_SEG).concat(CMD_LED_BRIGHT).concat(CMD_IO_KEY).concat(CMD_IO_PORT).concat(CMD_IO_ADC).concat(CMD_IO_IR).concat(CMD_IO_ENC).concat(CMD_IO_TEMP).concat(CMD_IO_SOUND).concat(CMD_IO_EEP).concat(CMD_IO_RTC).concat(CMD_IO_SYS),
        meta: {
            sysCode: 0x3430, // ???
            ledcnt: 512
        }
    }
    */
];

class DeviceSelector {
    private statusBarItem: StatusBarItem;
    private device: Device = DEVICES[2];

    constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 2);
        this.statusBarItem.command = 'led_basic.device';
        this.update();
    }

    /**
     * Returns currently selected device
     */
    public selectedDevice(): Device {
        return this.device;
    }

    /**
     * Set the device porgramatically
     * @param sysCode - system code of the device
     */
    public setDevice(sysCode: number) {
        const device = DEVICES.find((knownDevice: Device) => {
            return knownDevice.meta.sysCode === sysCode;
        });
        if (device) {
            this.device = device;
        } else {
            this.device = DEVICES[0];
        }
        this.update();
        return this.device;
    }

    /**
     * Opens a VS Code selection list with known/supported devices
     */
    public showSelection(): Promise<Device> {
        return new Promise((resolve, reject) => {
            window.showQuickPick(DEVICES)
                .then((entry) => {
                    if (entry) {
                        this.device = entry;
                        this.update();
                        resolve(entry);
                    }
                });
        });
    }

    public dispose() {
        this.statusBarItem.dispose();
    }

    /**
     * Update the status bar
     */
    private update() {
        const editor = window.activeTextEditor;
        if (!editor) {
            this.statusBarItem.hide();
            return;
        }

        if (editor.document.languageId !== 'led_basic') {
            this.statusBarItem.hide();
        } else {
            this.statusBarItem.text = this.device.label;
            this.statusBarItem.show();
        }
    }
}

function dev(name: string, argcount?: number): ICommand {
    return {
        name,
        argcount: argcount || 0
    };
}

export const deviceSelector = new DeviceSelector();
