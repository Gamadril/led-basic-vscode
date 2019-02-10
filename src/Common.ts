'use strict';

/**
 * Colour order constants
 */
export enum COLOUR_ORDER {
    RGB = 0xE4,
    GRB = 0xB4
};

export interface IError {
    message: string;
    range: IRange;
}

export interface IMatchResult {
    success: boolean;
    errors?: IError[]
}

export interface IPosition {
    line: number,
    character: number
}

export interface IRange {
    start: IPosition,
    end: IPosition
}

export interface IParseResult {
    success: boolean,
    code: Uint8Array,
    config: IConfig
}

export interface IConfig {
    gprint?: boolean;
    white?: boolean;
    sys_led?: number;
    ledcnt?: number;
    colour_order?: COLOUR_ORDER;
    cfg?: number;
    mbr?: number;
    led_type?: number;
    spi_rate?: number;
    frame_rate?: number;
}

/**
 * Device specific meta data 
 */
export interface IMetaData {
    sysCode: number;
    basver?: number;
    ledcnt?: number;
    default_ledcnt?: number;
    colour_order?: COLOUR_ORDER;
    cfg?: number;
    mbr?: number;
    led_type?: number;
    spi_rate?: number;
    needsSbProg?: boolean;
    noPrint?: boolean;
}

/**
 * Command structure
 */
export interface ICommand {
    name: string,
    argcount: number
}

export interface IDevice {
    label: string,
    detail?: string,
    meta: IMetaData,
    commands: ICommand[]
}

export interface ISerialPortInfo {
    name: string,
    serialNumber?: string,
    deviceName: string,
    sysCode: number
}

export interface ISerialPort {
    isOpen(): boolean,
    close(): Promise<void>,
    read(timeout?: number): Promise<Uint8Array>,
    write(data: Uint8Array): Promise<void>,
    openForUpload(brk?: boolean, dtr?: boolean): Promise<void>,
    dispose(): void
}

export interface ISerialPortOptions {
    baudRate: number,
    autoOpen?: boolean,
    parity?: string,
    hupcl?: boolean
}

export interface ISerialPortFactory {
    createSerialPort(name: string, options?: ISerialPortOptions): ISerialPort
}

export interface IOperationList {
    [op: string]: number;
}

interface ILibMap {
    [name: string]: {
        token: number,
        functions: {
            [name: string]: number
        }
    }
}

export interface IDevUploader {
    isOpen(): boolean,
    open(): Promise<void>,
    close(): Promise<void>,
    reset(): Promise<string>,
    write(data: Uint8Array): Promise<void>,
    read(timeout?: number): Promise<Uint8Array>,
    sendData(data: Uint8Array): Promise<void>
}

const LBO_HEADER_SIZE = 16;
export function parseResultToArray(result: IParseResult, meta: IMetaData): Uint8Array {
    var data = new Uint8Array(result.code.length + LBO_HEADER_SIZE);
    let header = createLboHeader(result.config, result.code.length, meta);
    data.set(header, 0);
    data.set(result.code, LBO_HEADER_SIZE);
    return data;
}

function createLboHeader(config: IConfig, codeLength: number, meta: IMetaData): Uint8Array {
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

export interface IDeviceError {
    line: number;
    code: number;
    msg: string;
}

export function decodeErrorMessage(error: string): IDeviceError | null {
    let result = null;
    let match = REG_ERROR.exec(error);
    if (match) {
        result = {
            code: parseInt(match[1], 10),
            line: parseInt(match[2], 10),
            msg: error
        }
        let err = ERROR_MAP[match[1]];
        if (err) {
            result.msg = '"' + err + ' in line ' + match[2] + '"';
        }
    }
    return result;
}

export const lib_map: ILibMap = {
    'led': {
        token: 0xAC,
        functions: {
            'setall': 0x81,
            'setled': 0x7A,
            'lrgb': 0x44,
            'lhsv': 0x3C,
            'show': 0x08,
            'irgb': 0x14,
            'ihsv': 0x1C,
            'iled': 0x2A,
            'iall': 0x21,
            'irange': 0x33,
            'rainbow': 0x5E,
            'copy': 0x4A,
            'repeat': 0x53,
            'shift': 0x63,
            'mirror': 0x6B,
            'blackout': 0x70,
            'clear': 0x88,
            'pdez': 0xC4,
            'adp': 0xB1,
            'achar': 0x9C,
            'pchar': 0x92,
            'praw': 0xA2,
            'araw': 0xAC,
            'phex': 0xBB,
            'bright': 0xC9,
            'update': 0xE0
        }
    },
    'io': {
        token: 0xAD,
        functions: {
            'waitkey': 0x08,
            'getkey': 0x10,
            'keystate': 0x68,
            'setport': 0x39,
            'clrport': 0x41,
            'getrtc': 0x19,
            'setrtc': 0x22,
            'getldr': 0x28,
            'getir': 0x30,
            'gettemp': 0x48,
            'xtempcnt': 0x70,
            'xtempval': 0x7A,
            'beep': 0x51,
            'getenc': 0x60,
            'setenc': 0x5B,
            'getpoti': 0x81,
            'getadc': 0x99,
            'eeread': 0x89,
            'eewrite': 0x92,
            'sys': 0xA2
        }
    }
};

export interface IJumpTable { [label: string]: number; }

type Action = (...args: any[]) => any;
export interface IEvalOperation { [index: string]: Action }