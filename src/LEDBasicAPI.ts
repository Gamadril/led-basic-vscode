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
    description: "Red component of the colour. [0..255]"
};

const green = {
    name: "g",
    description: "Green component of the colour. [0..255]"
};

const blue = {
    name: "b",
    description: "Blue component of the colour. [0..255]"
};

const hue = {
    name: "h",
    description: "Hue component of the colour. [0..359]"
};

const saturation = {
    name: "s",
    description: "Saturation component of the colour. [0..255]"
};

const value = {
    name: "v",
    description: "Value component of the colour. [0..255]"
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

const colour = {
    name: "colour",
    description: "Colour value. [0..7]  0-OFF  1-Red  2-Green  3-Yellow  4-Blue  5-Magenta  6-Cyan  7-White"
};

const pos = {
    name: "pos",
    description: "Position on the display. [0..3]"
};

const num = {
    name: "value",
    description: "Value to display. [0..65536]"
}

const width = {
    name: "width",
    description: "Number of places to use + 1. [0..3]"
}

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
        description: "Segments to be turned on bitwise. [0..127]\n\n![](res/segment.png)\n\nA=0x01, B=0x02, C=0x04, D=0x08, E=0x10, F=0x20, G=0x40"
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

/**
 * List of API functions for code completion
 */
export const API: ILibEntries = {
    'BUILTIN': {
        '###': {
            signature: '### Lxxx Cxxxy Mxxx Px Sx Tx Ax Fxx',
            description: 'Various global settings can be set via this configuration line. Please note that not every LED-Basic component supports all the parameters. Unsupported parameters are ignored. This line must be placed at the beginning of the BASIC code, otherwise the program will use the default values\n\n|Parameter|Description|Default|\n|---|---|---|\n|Lxxx|Number of connected LEDs (MAX_LEDS) [8..x]|L256, L128, L64|\n|Cxxxy|Colour order of the LEDs. GRB=WS2812, RGB=SK6812,APA102,APA106. CRGBW for RGBW LEDs|CGRB|\n|Mxxx|Master LED brightness in % [5..100]|M100|\n|Px|Print output on/off. 0=off, 1=on|P1|\n|Sx|Setup system LEDs. 0=off, 1=Output LED on, 2=Wait LED on, 3=All on|S3|\n|Tx|LED-type selection. Component dependent|T0|\n|Ax|SPI bitrate for suitable LED types [0..7]|A3|\n|Fxx|LED update framerate [0..100]|F25|'
        },
        'random': {
            signature: "random",
            description: 'Generates a positive random number between 0 and 32767.'
        },
        'delay': {
            signature: "delay <VAL|EXPR|VAR>",
            description: 'Stops the execution of the program for a period of time in milliseconds. The value must be in range 1 - 32767 (equivalent to approximately 32.8 seconds).'
        },
        'print': {
            description: 'Used for status or debug output via terminal output (not available for every LED-Basic Component).\nMultiple values or texts can be combined in one row. To do so use a comma or a semicolon. When using a comma a space is inserted, but when using a semicolon no space is inserted. The maximum length of the generated print text is 256 characters. Longer texts are truncated.\nThis command should be used sparingly for small amounts of data, because it reduces execution speed. The print function can be disabled globally using configuration parameter P0. If the data is sent too quickly, the terminal may be blocked due to a memory overflow, or the display may be corrupted. If the LED-Basic program hangs or crashes, briefly disconnect the USB connector from the component or Prog_SB.',
            signature: 'print <VAL|EXPR|VAR|STR> [;][,] [<VAL|EXPR|VAR|STR>]'
        },
        'data': {
            description: 'A maximum of 127 table values can be defined following a label. These may only be numerical values and cannot be changed by the program. You may use several **data** lines in succession, in which case each label may only have 126 values in total. All values must be a maximum of 16-bit (-32768... 32767).\nData lines should be defined at the beginning of the program and at the latest before their first use.\nThere must be no comment at the end of the data line, so if necessary place comments before it.',
            signature: 'data <VAL>[,<VAL>][,<VAL>]'
        },
        'read': {
            description: 'The **read** command accesses individual **data** values. First parameter is the label with data, second parameter is the index of the value to read.\nIf the program attempts to read past the last data value, no error is returned; read simply returns 0.',
            signature: 'read <VAL>,<VAL|EXPR|VAR>'
        },
        'end': {
            description: 'All commands behind **end** are ignored.',
            signature: 'let <VAR>=<VAL|EXPR|VAR>'
        },
        'let': {
            description: 'Assigns a value to a variable. **let** is optional and can be omitted.',
            signature: 'end'
        },
        'for': {
            description: 'FOR-NEXT loop. Ensure that the value **to** is never smaller than the value before **to**, and that the value after **downto** is never greater than the value before **downto**.\n**step** is always positive, even when using **downto**.\nIf **step** is not specified, the default increment is 1.\nIt is possible to nest a maximum of 4 FOR-NEXT loops. Always ensure that the loops are nested correctly.',
            signature: 'for <VAR>=<VAL|EXPR|VAR> to|downto <VAL|EXPR|VAR> [step <VAL|EXPR|VAR>]\n...\nnext VAR'
        },
        'if': {
            description: 'IF-THEN-ELSE. **then** is not strictly necessary but must be present if **else** is used. **else** is optional.\nAfter **then** or **else** only one command or expression is allowed. To execute multiple commands, you can use a sub-routine with **gosub/return**.',
            signature: 'if <VAL|EXPR|VAR> <REL> <VAL|EXPR|VAR> [then]... [else...]'
        },
        'goto': {
            description: 'Jump to a label for furher code execution. <VAL> must be a numerical value and not an expression.\nIt is possible to nest a maximum of 4 **gosub** routines.',
            signature: 'goto <VAL>'
        },
        'gosub': {
            description: 'Jump to a sub-routine for furher code execution and return back. <VAL> must be a numerical value and not an expression.',
            signature: 'goto <VAL>'
        }
    },
    'LED': {
        'show': {
            signature: "LED.show()",
            description: "The LEDs are displayed. Due to data transmission speeds, it takes 40ms (25 frames/second) for all to be displayed. Execution is therefore automatically limited to this speed. No LED display is possible without this command.",
            parameters: []
        },
        'lrgb': {
            signature: "LED.lrgb(led, r, g, b)",
            description: "LED at position **led** is set with values in **r**, **g** and **b**.",
            parameters: [led, red, green, blue]
        },
        'lhsv': {
            signature: "LED.lhsv(led, h, s, v)",
            description: "LED at position **led** is set with values **h**, **s** and **v**.",
            parameters: [led, hue, saturation, value]
        },
        'irgb': {
            signature: "LED.irgb(idx, r, g, b)",
            description: "Up to 10 LED colour presets can be stored in index registers. Colour index **idx** is set based on the values in **r**, **g** and **b**.",
            parameters: [idx, red, green, blue]
        },
        'ihsv': {
            signature: "LED.ihsv(idx, h, s, v)",
            description: "Up to 10 LED colour presets can be stored in index registers. Colour index **idx** is set based on the values in **h**, **s** and **v**.",
            parameters: [idx, hue, saturation, value]
        },
        'iled': {
            signature: "LED.iled(idx, led)",
            description: "LED at position **led** is displayed with the preset colour values in **idx**.",
            parameters: [idx, led]
        },
        'iall': {
            signature: "LED.iall(idx)",
            description: "All LEDs are shown with the preset colour values in **idx**.",
            parameters: [idx]
        },
        'irange': {
            signature: "LED.irange(idx, beg, end)",
            description: "The LEDs in the range of **beg** to **end** are shown with the preset colour value in **idx**.",
            parameters: [idx, start, end]
        },
        'rainbow': {
            signature: "LED.rainbow(h, s, v, beg, end, inc)",
            description: "A rainbow effect is applied to a set of LEDs defined by(**beg**..**end**). The start colour is defined by **h**, **s** and **v**. **inc** specifies the variation or gradient in colour between LEDs. If the value of **h** is continuously changed, the rainbow appears to move.",
            parameters: [hue, saturation, value, start, end, inc]
        },
        'copy': {
            signature: "LED.copy(from, to)",
            description: "The colour of a single LED in position **from** is copied to the LED in position **to**. The LED at position **from** remains unchanged.",
            parameters: [from, to]
        },
        'repeat': {
            signature: "LED.repeat(beg, end, count)",
            description: "The LED area **beg** to **end** is repeated **count** times.",
            parameters: [start, end, count]
        },
        'shift': {
            signature: "LED.shift(beg, end, to)",
            description: "The LED area **beg** to **end** is copied to after **to**.",
            parameters: [start, end, to]
        },
        'mirror': {
            signature: "LED.mirror(beg, end, to)",
            description: "The LED area **beg** to **end** is mirrored after **to**. Care should be taken to ensure that areas **beg..end** and **to** do not overlap, to avoid undesirable effects.",
            parameters: [start, end, to]
        },
        'blackout': {
            signature: "LED.blackout()",
            description: "All LEDs are switched off. LED.show() is not required.",
            parameters: []
        },
        'setled': {
            signature: "LED.setled(led, colour)",
            description: "LED **led** will be set to colour **colour**",
            parameters: [led, colour]
        },
        'setall': {
            signature: "LED.setall(colour)",
            description: "All LEDs are set to colour **colour**",
            parameters: [colour]
        },
        'bright': {
            signature: "LED.bright(value)",
            description: "Sets brightness of the LEDs or the display. Note: Brightness changes in the upper range are barely noticeable by the human eye but have a disproportionate effect on the LED's power consumption.",
            parameters: [{
                name: "value",
                description: "Brightness value."
            }]
        },
        'clear': {
            signature: "LED.clear()",
            description: "The display is cleared, all segements off. This command should not be put in a loop or the display will flicker.",
            parameters: []
        },
        'pchar': {
            signature: "LED.pchar(pos, char)",
            description: "Puts the predefined character **char** in position **pos** (+1). **pos** specifies the 7-segment position at which the character is to be output, from left to right (0..3). The decimal point display remains unaffected.",
            parameters: [pos, char]
        },
        'achar': {
            signature: "LED.achar(ch1, ch2, ch3, ch4)",
            description: "Outputs all 4 characters at the same time. Values of all 4 characters must be specified.",
            parameters: [ch1, ch2, ch3, ch4]
        },
        'praw': {
            signature: "LED.praw(pos, raw)",
            description: "Outputs the character in **raw** in position **pos** (+1). **pos** specifies the 7-segment position at which the character is to be output, from left to right (0..3). The decimal point display remains unaffected.",
            parameters: [pos, raw]
        },
        'araw': {
            signature: "LED.araw(raw1, raw2, raw3, raw4)",
            description: "Outputs all 4 characters at the same time in raw mode. Values of all 4 characters must be specified.",
            parameters: [raw1, raw2, raw3, raw4]
        },
        'adp': {
            signature: "LED.adp(dp)",
            description: "Sets the decimal point location via bit-code. All other segments display remains untouched.",
            parameters: [{
                name: "dp",
                description: "Decimal point bit coded. Bit X = Position X. [0..255]"
            }]
        },
        'phex': {
            signature: "LED.phex(pos, value, width)",
            description: "Outputs the value in **value** as hexadecimal on the display at position **pos** (+1). The value in **width** (+1) specifies the width of the output. The hexadecimal display always has 0 prefixes.",
            parameters: [pos, num, width]
        },
        'pdez': {
            signature: "LED.pdez(pos, value, width, lzero)",
            description: "Outputs the value in **value** as a decimal number on the display at position **pos** (+1). The value in **width** (+1) specifies the width of the output. The value in **lzero** specifies whetever prefix 0s should be suppressed. If a value greater than 9999 is specified, the display is blank.",
            parameters: [pos, num, width, {
                name: "lzero",
                description: "Show leading zeros. 0 = no, 1 = yes"
            }]
        },
        'update': {
            signature: "LED.update()",
            description: "Updates the current state on 7-segment displays. This command should be only called after change of the display content.",
            parameters: []
        }
    },
    'IO': {
        'waitkey': {
            signature: "IO.waitkey()",
            description: "Program waits for any key press. The WAIT LED flashes, unless disabled vias SX in the configuration line.",
            parameters: []
        },
        'getkey': {
            signature: "IO.getkey()",
            description: "Whilst the program is running, the status of buttons can be queried. The number of buttons depends on the component in use. The key press remains stored until a query has been made.",
            parameters: []
        },
        'keystate': {
            signature: "IO.keystate()",
            description: "Returns bit coded value indicating all pressed buttons.",
            parameters: []
        },
        'setport': {
            signature: "IO.setport(port)",
            description: "Sets the output ports to HIGH level. The value in **port** specifies whic of the ports are affected.",
            parameters: [{
                name: "port",
                description: "Bit coded value for the port(s). Port 1 = Bit 0, Port 2 = Bit 1, etc."
            }]
        },
        'clrport': {
            signature: "IO.clrport(port)",
            description: "Sets the output ports to LOW level. The value in **port** specifies whic of the ports are affected.",
            parameters: [{
                name: "port",
                description: "Bit coded value for the port(s). Port 1 = Bit 0, Port 2 = Bit 1, etc."
            }]
        },
        'getrtc': {
            signature: "IO.getrtc(idx)",
            description: "Reads the values of the real-time clock (RTC) module (if available).",
            parameters: [rtc_idx]
        },
        'setrtc': {
            signature: "IO.getrtc(idx, val)",
            description: "Sets the real-time clock (RTC) (if available). If you want to write multiple values starting with the lowest **idx**, it is useful to first read the desired value, change it and then write it again.",
            parameters: [rtc_idx,
                {
                    name: "val",
                    description: "Value to set for the component."
                }]
        },
        'getldr': {
            signature: "IO.getldr()",
            description: "Reads the value of the LDR sensor (if present). The result is in range [0..255]",
            parameters: []
        },
        'getir': {
            signature: "IO.getir()",
            description: "Reads the value of the IR receiver (if present). The first byte of the result contains the number of repetitions caused by long-pressing the button. The last byte contains the key value. 0 means that there is no data.",
            parameters: []
        },
        'gettemp': {
            signature: "IO.gettemp()",
            description: "Reads the value of the DS18B20 sensor (if present). Result is a value in 0.1°c resolution. Due to the relatively long duration of the scan, the query should not be made at shorter intervals than 1 second. The sensor's measurement process is only started by reading a value, so the first value read should be discarded. Examples: 0=0°C, 217=21.7°C, 81=8.1°C",
            parameters: []
        },
        'xtempcnt': {
            signature: "IO.xtempcnt()",
            description: "Returns the number of detected temperature sensors.",
            parameters: []
        },
        'xtempval': {
            signature: "IO.xtempval(nr, idx)",
            description: "Reads different parameters from DS18B20 sensors (if present).",
            parameters: [{
                name: "nr",
                description: "Index of the sensor to read from. [0..X]"
            }, {
                name: "idx",
                description: "Parameter to read.\n\n|idx|returned result|\n|:---:|---|\n|0|0 = invalid temperature, 1 = valid temperature|\n|1|temperature with 0.1°C resolution|\n|2|0 = parasitic power supply, 1 = external power supply|\n|3..10|ROM-ID of the sensor|"
            }]
        },
        'beep': {
            signature: "IO.beep(val)",
            description: "Generates a sound from the loudspeaker (if present). Frequencies below 200 Hz cannot be generated due to system conditions.",
            parameters: [{
                name: "val",
                description: "|val|Meaning|\n|:---:|---|\n|0|Mute|\n|1..36|Notes|\n|200...|frequency = val Hz|\n\nThe following note values are allowed:\n\n|Val|Note|Val|Note|Val|Note|Val|Note|\n|:---:|---|:---:|---|:---:|---|:---:|---|\n|1|C2|10|A2|19|F3#|28|D4#|\n|2|C2#|11|A2#|20|G3|29|E4|\n|3|D2|12|H2|21|G3#|30|F4|\n|4|D2#|13|C3|22|A3|31|F4#|\n|5|E2|14|C3#|23|A3#|32|G4|\n|6|F2|15|D3|24|H3|33|G4#|\n|7|F2#|16|D3#|25|C4|34|A4|\n|8|G2|17|E3|26|C4#|35|A4#|\n|9|G2#|18|F3|27|D4|36|H4|\n"
            }]
        },
        'getenc': {
            signature: "IO.getenc()",
            description: "Reads the current value of the incremental encoder (if present).",
            parameters: []
        },
        'setenc': {
            signature: "IO.setenc(pos, max, stop)",
            description: "Sets the parameters for the incremental encoder (if present).",
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
        'getpoti': {
            signature: "IO.getpoti(idx)",
            description: "Reads the value of a potentiometer, or its converted value (if present).",
            parameters: [{
                name: "idx",
                description: "Component dependent. [0..X]"
            }]
        },
        'getadc': {
            signature: "IO.getadc(idx)",
            description: "Reads an analogue value. The values that can be read depend on the component.",
            parameters: [{
                name: "idx",
                description: "Component dependent. [0..X]"
            }]
        },
        'eeread': {
            signature: "IO.eeread(adr)",
            description: "Reads the content of the EEPROM at address **adr** (if available). Returns a 16-bit value. Always returns 0 if **adr** is invalid.",
            parameters: [{
                name: "adr",
                description: "Address to read data from. [0..X]"
            }]
        },
        'eewrite': {
            signature: "IO.eewrite(adr, data)",
            description: "Writes the 16-bit value to the EEPROM (if available). Please note that the write operation may take several milliseconds and thus delay the program's execution. To prolong the life of the EEPROM, write operations should be avoided where possible, and values saved only if they have changed.",
            parameters: [{
                name: "adr",
                description: "Address to read data from. [0..X]"
            }, {
                name: "data",
                description: "16-bit value to write. [-32768..32767]"
            }]
        },
        'sys': {
            signature: "IO.sys(par1, par2)",
            description: "Universal command to set or read system parameters (if present). Both parameters must always be passed, even if they are not needed.",
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