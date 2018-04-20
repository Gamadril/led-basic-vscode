'use strict';

export interface IParam { name: string, description: string }
export interface IEntry { description: string; signature: string; parameters?: IParam[] }
export interface IEntries { [name: string]: IEntry; }
export interface ILibEntries { [name: string]: IEntries; }

const led = {
    name: "led",
    description: 'Index of the LED. [0..MAX_LEDS-1]'
};

const idx = {
    name: "idx",
    description: 'Index of the register. [0..9]'
};

const red = {
    name: "r",
    description: "Red component of the color. [0..255]"
};

const green = {
    name: "g",
    description: "Green component of the color. [0..255]"
};

const blue = {
    name: "b",
    description: "Blue component of the color. [0..255]"
};

const hue = {
    name: "h",
    description: "Hue component of the color. [0..359]"
};

const saturation = {
    name: "s",
    description: "Saturation component of the color. [0..255]"
};

const value = {
    name: "v",
    description: "Value component of the color. [0..255]"
};

const start = {
    name: "beg",
    description: "Start index of the range. [0..MAX_LEDS-1]"
};

const end = {
    name: "end",
    description: "End index of the range. [beg..MAX_LEDS-1]"
};

const inc = {
    name: "inc",
    description: "Defines the incremental step for the effect. [0..100]"
};

const from = {
    name: "from",
    description: "Source LED index. [0..MAX_LEDS-1]"
};

const to = {
    name: "to",
    description: "Destination LED index. [0..MAX_LEDS-1]"
};

const count = {
    name: "count",
    description: "Number of copies to make. [1..x]"
};

const color = {
    name: "color",
    description: "Color value. [0..7]  0-OFF  1-Red  2-Green  3-Yellow  4-Blue  5-Magenta  6-Cyan  7-White"
};

const pos = {
    name: "pos",
    description: "Position of the display segment. [0..3]"
};

function pchar(name?: string): IParam {
    let result: IParam = {
        name: name || 'char',
        description: "Value of the character. [0..29]\n\n|value|character|value|character|value|character|\n|---|---|---|---|---|---|\n|0|0|10|A|20|-|\n|1|1|11|b|21| |\n|2|2|12|C|22|i|\n|3|3|13|d|23|n|\n|4|4|14|E|24|r|\n|5|5|15|F|25|N|\n|6|6|16|H|26|t|\n|7|7|17|L|27|o|\n|8|8|18|P|28|G|\n|9|9|19|U|29|Y|"
    };
    return result;
}

function praw(name?: string): IParam {
    let result: IParam = {
        name: name || 'raw',
        description: "Bit coded character value. [0..127]\n\n![](res/segment.png)\n\nA=0x01, B=0x02, C=0x04, D=0x08, E=0x10, F=0x20, G=0x40"
    };
    return result;
}

const rtc_idx = {
    name: "idx",
    description: "|idx|component|range|\n|:---:|:---|:---|\n|0|second|0..59|\n|1|minute|0..59|\n|2|hour|0..23|\n|3|day|1..28/29/30/31|\n|4|month|1..12|\n|5|year|2000..20XX|\n|6|day of year|1..365/366|\n|7|day of week|0..6|\n|8|leap-year|0=no, 1=yes|"
}

const char = pchar();
const ch1 = pchar('ch1');
const ch2 = pchar('ch2');
const ch3 = pchar('ch3');
const ch4 = pchar('ch4');

const raw = praw();
const raw1 = praw('raw1');
const raw2 = praw('raw2');
const raw3 = praw('raw3');
const raw4 = praw('raw4');

export const API: ILibEntries = {
    KEYWORDS: {
        random: {
            signature: "random",
            description: 'Generates a positive number between 0 and 32767'
        },
        delay: {
            signature: "delay",
            description: 'Stops the execution of the program for a period of time in milliseconds. The value must be in range 1 - 32767.'
        },
        '###': {
            signature: '### Lxxx Cxxxy Px Sx Tx Ax Fxx',
            description: 'Configuration line for settings up different global parameters for the device.\n\n|parameter|description|default value|\n|---|---|---|\n|Lxxx|Number of connected LEDs (MAX_LEDS) [8..x]|L256, L128, L64|\n|Cxxxy|Color order of the LEDs. GRB=WS2812, RGB=SK6812,APA102,APA106. CRGBW for RGBW leds|CGRB|\n|Mxxx|Master brightness in % [5..100]|M100|\n|Px|Turns global print output on/off. 0=off, 1=on|P1|\n|Sx|Setup system LEDs. 0=off, 1=Output LED on, 2=Wait LED on, 3=All on|S3|\n|Tx|LED-type selection. Component dependent|T0|\n|Ax|SPI bitrate for suitable LED types [0..7]|A3|\n|Fxx|LED update framerate|F25|'
        }
    },
    BUILTIN: {
        delay: {
            description: 'Stops the execution of the program for a period of time in milliseconds. The value must be in range 1-32767.',
            signature: 'delay <VAL|EXPR|VAR>'
        },
        print: {
            description: 'Prints messages to a terminal when connected to host. Might be not supported by some devices.',
            signature: 'print <VAL|EXPR|VAR|STR> [;][,] [<VAL|EXPR|VAR|STR>]'
        },
        data: {
            description: 'Up to 127 values can be defined behind a label. They can be only numbers in range -32768 - 32767.',
            signature: 'data <VAL>[,<VAL>][,<VAL>]'
        },
        read: {
            description: 'Used for accessing specific values in the data block.',
            signature: 'read <VAL>,<VAL|EXPR|VAR>'
        }
    },
    LED: {
        show: {
            signature: "LED.show()",
            description: "Starts sending data to LEDs.",
            parameters: []
        },
        lrgb: {
            signature: "LED.lrgb(led, r, g, b)",
            description: "Assign RGB color value to a LED.",
            parameters: [led, red, green, blue]
        },
        lhsv: {
            signature: "LED.lhsv(led, h, s, v)",
            description: "Assign HSV color value to a LED.",
            parameters: [led, hue, saturation, value]
        },
        irgb: {
            signature: "LED.irgb(idx, r, g, b)",
            description: "Saves RGB color value in a color register.",
            parameters: [idx, red, green, blue]
        },
        ihsv: {
            signature: "LED.ihsv(idx, h, s, v)",
            description: "Saves HSV color value in a color register.",
            parameters: [idx, hue, saturation, value]
        },
        iled: {
            signature: "LED.iled(idx, led)",
            description: "Assigns the color value saved in a register to a LED.",
            parameters: [idx, led]
        },
        iall: {
            signature: "LED.iall(idx)",
            description: "Assigns the color value saved in a register to all LEDs",
            parameters: [idx]
        },
        irange: {
            signature: "LED.irange(idx, beg, end)",
            description: "Assigns the color value saved in a register to LEDs in a range.",
            parameters: [idx, start, end]
        },
        rainbow: {
            signature: "LED.rainbow(h, s, v, beg, end, inc)",
            description: "Creates a rainbow effect in the range.",
            parameters: [hue, saturation, value, start, end, inc]
        },
        copy: {
            signature: "LED.copy(from, to)",
            description: "Copies a color value from one LED to another.",
            parameters: [from, to]
        },
        repeat: {
            signature: "LED.repeat(beg, end, count)",
            description: "Repeat a range of color values several times.",
            parameters: [start, end, count]
        },
        shift: {
            signature: "LED.shift(beg, end, to)",
            description: "Shifts a range to specified LED index.",
            parameters: [start, end, to]
        },
        mirror: {
            signature: "LED.mirror(beg, end, to)",
            description: "Mirrors a range to specified LED index.",
            parameters: [start, end, to]
        },
        blackout: {
            signature: "LED.blackout()",
            description: "Turns all LEDs off. Calling LED.show() is not required in that case.",
            parameters: []
        },
        setled: {
            signature: "LED.setled(led, color)",
            description: "Assigns a color to a LED",
            parameters: [led, color]
        },
        setall: {
            signature: "LED.setall(color)",
            description: "Assings a color to all LEDs",
            parameters: [color]
        },
        bright: {
            signature: "LED.bright(value)",
            description: "Changes the brightness of all LEDs or a display.",
            parameters: [{
                name: "value",
                description: "Brightness value."
            }]
        },
        clear: {
            signature: "LED.clear()",
            description: "Clears all display segments.",
            parameters: []
        },
        pchar: {
            signature: "LED.pchar(pos, char)",
            description: "Shows one character in a display segment.",
            parameters: [pos, char]
        },
        achar: {
            signature: "LED.achar(ch1, ch2, ch3, ch4)",
            description: "Shows all character in the display in one call.",
            parameters: [ch1, ch2, ch3, ch4]
        },
        praw: {
            signature: "LED.praw(pos, raw)",
            description: "Shows a raw bit coded character in a display segment.",
            parameters: [pos, raw]
        },
        araw: {
            signature: "LED.araw(raw1, raw2, raw3, raw4)",
            description: "Shows all raw bit coded characters in the display in one call.",
            parameters: [raw1, raw2, raw3, raw4]
        },
        adp: {
            signature: "LED.adp(dp)",
            description: "Shows decimal points in a display segment",
            parameters: [{
                name: "dp",
                description: "Decimal point bit coded. Bit X=segment X. [0..15]"
            }]
        }
    },
    IO: {
        waitkey: {
            signature: "IO.waitkey()",
            description: "Waits for a key press. WAIT LED is blinking if not deactivated.",
            parameters: []
        },
        getkey: {
            signature: "IO.getkey()",
            description: "Returns the index of a pressed button.",
            parameters: []
        },
        keystate: {
            signature: "IO.keystate()",
            description: "Returns bit coded value indicating all pressed buttons.",
            parameters: []
        },
        setport: {
            signature: "IO.setport(port)",
            description: "Sets the output port to HIGH level.",
            parameters: [{
                name: "port",
                description: "Bit coded value for the port(s). Port 1 = Bit 0, Port 2 = Bit 1, etc."
            }]
        },
        clrport: {
            signature: "IO.clrport(port)",
            description: "Sets the output port to LOW level.",
            parameters: [{
                name: "port",
                description: "Bit coded value for the port(s). Port 1 = Bit 0, Port 2 = Bit 1, etc."
            }]
        },
        getrtc: {
            signature: "IO.getrtc(idx)",
            description: "Reads the values of the RTC module (if present).",
            parameters: [rtc_idx]
        },
        setrtc: {
            signature: "IO.getrtc(idx, val)",
            description: "Sets the values of the RTC module (if present).",
            parameters: [rtc_idx,
                {
                    name: "val",
                    description: "Value to set for the component."
                }]
        },
        getldr: {
            signature: "IO.getldr()",
            description: "Reads the value of the LDR sensor (if present). The result is in range [0..255]",
            parameters: []
        },
        getir: {
            signature: "IO.getir()",
            description: "Returns the value of the IR receiver (if prsent). The first byte of the result contains the number of remote key presses. The last byte contains the key value.",
            parameters: []
        },
        gettemp: {
            signature: "IO.gettemp()",
            description: "Returns the temperature from the DS18B20 sensor (if prsent). The result has 0.1 resolution. 0=0°C, 217=21.7°C, 81=8.1°C",
            parameters: []
        },
        xtempcnt: {
            signature: "IO.xtempcnt()",
            description: "Returns the number of detected temperature sensors.",
            parameters: []
        },
        xtempval: {
            signature: "IO.xtempval(nr, idx)",
            description: "Reads different parameters from DS18B20 sensors (if present).",
            parameters: [{
                name: "nr",
                description: "Index of the sensor to read. [0..X]"
            }, {
                name: "idx",
                description: "Parameter to read.\n\n|idx|returned result|\n|:---:|---|\n|0|0 = invalid temperature, 1 = valid temperature|\n|1|temperature with 0.1°C resolution|\n|2|0 = parasitic power supply, 1 = external power supply|\n|3..10|ROM-ID of the sensor|"
            }]
        },
        beep: {
            signature: "IO.beep(val)",
            description: "Generates sound buzzer using onboard buzzer (if present).",
            parameters: [{
                name: "val",
                description: "|val|description|\n|:---:|---|\n|0|sound off|\n|1..36|notes|\n|200...|frequency in hz|\n\nFollowing notes are defined:\n\n|val|note|val|note|val|note|val|note|\n|:---:|---|:---:|---|:---:|---|:---:|---|\n|1|C2|10|A2|19|F3#|28|D4#|\n|2|C2#|11|A2#|20|G3|29|E4|\n|3|D2|12|H2|21|G3#|30|F4|\n|4|D2#|13|C3|22|A3|31|F4#|\n|5|E2|14|C3#|23|A3#|32|G4|\n|6|F2|15|D3|24|H3|33|G4#|\n|7|F2#|16|D3#|25|C4|34|A4|\n|8|G2|17|E3|26|C4#|35|A4#|\n|9|G2#|18|F3|27|D4|36|H4|\n"
            }]
        },
        getenc: {
            signature: "IO.getenc()",
            description: "Returns the current value of the incremental encoder (if present).",
            parameters: []
        },
        setenc: {
            signature: "IO.setenc(pos, max, stop)",
            description: "Configures the incremental encoder (if present).",
            parameters: [{
                name: "pos",
                description: "Start position of the incremental encoder. [0..max]"
            }, {
                name: "max",
                description: "Maximum value of the incremental encoder. [1..65535]"
            }, {
                name: "stop",
                description: "Behaviour of the rotary encoder at the range edges.\n\nstop = 0 - Allows value overflow\n\nstop = 1 - Value will stop at maximum, minimum"
            }]
        },
        getpoti: {
            signature: "IO.getpoti(idx)",
            description: "Returns the value of a potentiometer (if present).",
            parameters: [{
                name: "idx",
                description: "Component dependent. [0..X]"
            }]
        },
        eeread: {
            signature: "IO.eeread(adr)",
            description: "Reads a value from EEPROM (if present). Returns a 16bit value.",
            parameters: [{
                name: "adr",
                description: "Address to read data from. [0..X]"
            }]
        },
        eewrite: {
            signature: "IO.eeread(adr, data)",
            description: "Writes a 16bit value to EEPROM (if present).",
            parameters: [{
                name: "adr",
                description: "Address to read data from. [0..X]"
            }, {
                name: "data",
                description: "16bit data to write. [-32768..32767]"
            }]
        },
        sys: {
            signature: "IO.sys(par1, par2)",
            description: "Universal function to read or write system parameters.",
            parameters: [{
                name: "par1",
                description: "Component dependent."
            }, {
                name: "par2",
                description: "Component dependent."
            }]
        },
    }

}