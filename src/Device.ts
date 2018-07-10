'use strict';

import { QuickPickItem } from "vscode";

/**
 * Colour order constants
 */
export enum COLOUR_ORDER {
    RGB = 0xE4,
    GRB = 0xB4
};

/**
 * Command structure
 */
export interface ICommand {
    name: string,
    argcount: number
}

/**
 * Device specific meta data 
 */
interface IMetaData {
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
 * Device structure used for selection
 */
export class Device implements QuickPickItem {
    label: string;
    detail?: string | undefined;
    meta: IMetaData = {
        sysCode: 0
    };
    commands!: ICommand[];

    constructor(name: string) {
        this.label = name;
    }
}