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
    read(size?: number): Promise<Uint8Array>,
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