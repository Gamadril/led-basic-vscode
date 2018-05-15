'use strict';

import ohm = require('ohm-js')
import fs = require('fs');
import { getExtensionPath } from "./utils";
import { Range, Position } from 'vscode';
import { COLOR_ORDER } from './Device';

interface IJumpTable { [label: string]: number; }
interface IOperationList { [op: string]: number; }

interface IParseResult {
    success: boolean,
    code: Uint8Array,
    config: IConfig
}

export interface IConfig {
    gprint?: boolean;
    white?: boolean;
    sys_led?: number;
    ledcnt?: number;
    color_order?: COLOR_ORDER;
    cfg?: number;
    mbr?: number;
    led_type?: number;
    spi_rate?: number;
    frame_rate?: number;
}

export interface IError {
    message: string;
    range: Range;
}
export interface IMatchResult {
    success: boolean;
    errors?: IError[]
}
interface ILibMap {
    [name: string]: {
        token: number,
        functions: {
            [name: string]: number
        }
    }
}

const lib_map: ILibMap = {
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
            'bright': 0xC9
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
            'eeread': 0x89,
            'eewrite': 0x92,
            'sys': 0xA2
        }
    }
};

class LEDBasicParser {
    private _grammar: ohm.Grammar;
    private _semantics: ohm.Semantics;

    private JumpTable: IJumpTable = {};
    private lineNumber = 0;

    constructor() {
        let grammar = fs.readFileSync(getExtensionPath() + 'res/grammar.ohm').toString();

        this._grammar = ohm.grammar(grammar);
        this._semantics = this.createSemantics();
    }

    /**
     * Checks if the provided code respects the grammar. Returns generated errors for the "PROBLEMS" view 
     * @param text - source code
     */
    match(text: string): IMatchResult {
        let result: IMatchResult = {
            success: true
        }

        let match = this._grammar.match(text);
        if (match.failed()) {
            result.success = false;
            let errors: IError[] = [];
            if (match.shortMessage) {
                let parts = /Line (\d+), col (\d+): (.*)/g.exec(match.shortMessage);
                if (parts) {
                    let pos = new Position(parseInt(parts[1]) - 1, parseInt(parts[2]));
                    let error: IError = {
                        message: parts[3],
                        range: new Range(pos, pos)
                    }
                    errors.push(error);
                    result.errors = errors;
                }
            }
        }

        return result;
    }

    /**
     * Generates tokenized code for the upload. Provides local configuration properties if detected in the code.
     * @param text - source code
     */
    build(text: string): IParseResult | null {
        var check = this.match(text);
        if (!check.success) {
            return null;
        }

        let result: IParseResult = this._semantics(this._grammar.match(text)).eval();
        return result;
    }

    /**
     * Build local semantics for generating tokenized output for the target device
     */
    private createSemantics() {
        let result = this._grammar.createSemantics();
        let errors: IError[] = [];

        result.addOperation('eval', {
            Program: (comments, configLine, lines) => {
                this.JumpTable = {};
                this.lineNumber = 1;
                errors = [];

                var coms = comments.eval();
                var conf = configLine.eval();
                var main = lines.eval();
                var len = 0;
                this.lineNumber += coms.length;
                this.lineNumber += conf.length;

                function getLine(i: number) {
                    return comments.children.length + configLine.children.length + i;
                }

                var isInLabel = false;
                var hasData = false;
                var dataLengthPos = 0;
                // first run, calc final size and create a jump table for labels
                for (let i = 0; i < main.length; i++) {
                    let type = main[i].type;
                    if (type === 'label') {
                        let label = new DataView(main[i].value.buffer).getUint16(0, true) - 0x8000;
                        if (this.JumpTable[label] !== undefined) {
                            let iLine = getLine(i);
                            errors.push({
                                message: 'Label ' + label + ' is already defined',
                                range: new Range(new Position(iLine, 0), new Position(iLine, lines.child(i).sourceString.indexOf(':')))
                            });
                        } else {
                            this.JumpTable[label] = len;
                        }

                        isInLabel = true;
                        hasData = false;
                    } else if (type === 'dataline') {
                        if (!isInLabel && !main[i].label) {
                            let iLine = getLine(i);
                            errors.push({
                                message: 'Data definition is only possible after a label.',
                                range: new Range(new Position(iLine, 0), new Position(iLine, lines.child(i).sourceString.length))
                            });
                        }

                        if (main[i].label) {
                            let label = new DataView(main[i].label.value.buffer).getUint16(0, true) - 0x8000;
                            if (this.JumpTable[label] !== undefined) {
                                let iLine = getLine(i);
                                errors.push({
                                    message: 'Label ' + label + ' is already defined',
                                    range: new Range(new Position(iLine, 0), new Position(iLine, lines.child(i).sourceString.indexOf(':')))
                                });
                            } else {
                                this.JumpTable[label] = len;
                            }

                            isInLabel = true;
                            hasData = false;
                        }

                        if (!hasData) {
                            len += 2; // line number
                            len += 2; // length of all data and data token 
                            hasData = true;
                        }
                    } else if (type === 'return') {
                        if (!isInLabel) {
                            let iLine = getLine(i);
                            errors.push({
                                message: 'return requires a label to return from',
                                range: new Range(new Position(iLine, 0), new Position(iLine, lines.child(i).sourceString.length))
                            });

                        }
                        len += 2; // line number and length
                    } else if (type !== 'emptyline') {
                        hasData = false;
                        //isInLabel = false;
                        len += 2; // line number and length
                    }
                    len += main[i].value.length;
                }

                var result = new Uint8Array(len + 2); // 0xFFFF end of stream
                var dv = new DataView(result.buffer);

                len = 0;
                isInLabel = false;
                hasData = false;
                for (let i = 0; i < main.length; i++) {
                    let val = main[i].value;
                    let type = main[i].type;

                    if (type === 'emptyline') {
                        this.lineNumber++;
                        continue;
                    }

                    if (type === 'dataline') {
                        if (!hasData) {
                            hasData = true;
                            dv.setUint16(len, this.lineNumber, true);
                            len += 2;
                            dataLengthPos = len;
                            result[dataLengthPos] = val.length + 1; // 1 byte for following data token
                            len++;
                            result[len] = 0xAE;
                            len++;
                        } else {
                            result[dataLengthPos] += val.length;
                        }
                        result.set(val, len);
                        len += val.length;
                        this.lineNumber++;
                        //console.log(Utils.dump(result));
                        continue;
                    } else if (type === 'label') {
                        hasData = false;
                    } else {
                        // check for jumps and dataread
                        for (var j = 0; j < val.length; j++) {
                            if ((val[j] === 0x95 || val[j] === 0x96 || val[j] === 0xAF) && j < val.length - 2) {
                                let locdv = new DataView(val.buffer);
                                let label = locdv.getUint16(j + 1, true);
                                if (label & 0x8000) {
                                    let addr = this.JumpTable[label - 0x8000];
                                    if (val[j] === 0xAF) {
                                        addr += 5;
                                    }
                                    locdv.setUint16(j + 1, addr, true);
                                }
                            }
                        }

                        dv.setUint16(len, this.lineNumber, true);
                        len += 2;
                    }

                    result.set(val, len);
                    len += val.length;
                    this.lineNumber++;

                    //console.log(Utils.dump(result));
                }

                result.set([0xFF, 0xFF], len);

                if (errors.length) {
                    let errorResult: IMatchResult = {
                        success: false,
                        errors: errors
                    };
                    return errorResult;
                }

                return {
                    success: true,
                    code: result,
                    config: conf[0] || {}
                };
            },
            configLine: function (a, b, lnbr) {
                var elem, i, cparams = b.sourceString.trim().split(' '),
                    result: IConfig = {
                    },
                    cfg_id, cfg_param;

                for (i = 0; i < cparams.length; i++) {
                    elem = cparams[i];
                    cfg_id = elem.substr(0, 1);
                    cfg_param = elem.substring(1);

                    if (cfg_id === 'L') {
                        result.ledcnt = parseInt(cfg_param, 10);
                    } else if (cfg_id === 'C') {
                        if (cfg_param === 'RGB') {
                            result.color_order = COLOR_ORDER.RGB;
                            result.white = false;
                        } else if (cfg_param === 'GRB') {
                            result.color_order = COLOR_ORDER.GRB;
                            result.white = false;
                        } else if (cfg_param === 'GRBW') {
                            result.color_order = COLOR_ORDER.GRB;
                            result.white = true;
                        } else if (cfg_param === 'RGBW') {
                            result.color_order = COLOR_ORDER.RGB;
                            result.white = true;
                        }
                    } else if (cfg_id === 'M') {
                        result.mbr = parseInt(cfg_param, 10);
                    } else if (cfg_id === 'P') {
                        result.gprint = cfg_param === '0' ? false : true;
                    } else if (cfg_id === 'S') {
                        result.sys_led = parseInt(cfg_param, 10);
                    } else if (elem.startsWith('T')) {
                        result.led_type = parseInt(cfg_param, 10);
                    } else if (elem.startsWith('A')) {
                        result.spi_rate = parseInt(cfg_param, 10);
                    } else if (elem.startsWith('F')) {
                        result.frame_rate = parseInt(cfg_param, 10);
                    }
                }
                return result;
            },
            emptyLine: function (e, eol) {
                return {
                    type: 'emptyline',
                    value: new Uint8Array(0)
                };
            },
            Line: function (e, comment, eol) {
                var result;
                var ev = e.eval();
                if (ev.type === 'label' || ev.type === 'dataline') {
                    result = new Uint8Array(ev.value.length);
                    result.set(ev.value, 0);
                } else {
                    result = new Uint8Array(ev.value.length + 1);
                    result[0] = ev.value.length;
                    result.set(ev.value, 1);
                }

                let line = {
                    type: ev.type,
                    value: result,
                    label: undefined
                };
                if (ev.label) {
                    line.label = ev.label;
                }
                return line;
            },
            Statement: function (e) {
                var ev = e.eval();
                var result = new Uint8Array(ev.value.length);
                result.set(ev.value, 0);
                return {
                    type: ev.type,
                    value: result
                };
            },
            Label: function (labelLit, colon) {
                // if (Labels.indexOf(labelLit) !== -1) {
                //   throw 'Label ' + labelLit + ' already exists'
                // }
                var label = parseInt(labelLit.sourceString, 10);
                if (label > 0x7FFE) {
                    throw 'Label value to big. Max number allowed: 32766';
                }
                var result = new Uint8Array(3);
                var dv = new DataView(result.buffer);
                dv.setUint16(0, label | 0x8000, true);
                result[2] = 0;

                return {
                    type: 'label',
                    value: result
                };
            },
            variableDecl: function (e) {
                var variable = e.sourceString.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
                var result = new Uint8Array(1);
                result[0] = variable;
                return {
                    type: 'vardec',
                    value: result
                };
            },
            variable: function (e) {
                var variable = e.sourceString.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
                var result = new Uint8Array(2);
                result[0] = 0x8A;
                result[1] = variable;
                return {
                    type: 'var',
                    value: result
                };
            },
            Assignment: function (letLit, left, equalSign, right) {
                var rightSide = right.eval();
                var variable = left.eval();

                var result = new Uint8Array(variable.value.length + rightSide.value.length + 1);
                result[0] = 0x8B;
                result.set(variable.value, 1);
                result.set(rightSide.value, variable.value.length + 1);

                return {
                    type: 'assign',
                    value: result
                };
            },
            Expression: function (e) {
                return e.eval();
            },
            LogicOrExpression_logor: function (a, orLit, b) {
                var left = a.eval();
                var right = b.eval();
                var result = new Uint8Array(left.value.length + right.value.length + 1);
                result.set(left.value, 0);
                result[left.value.length] = 0xB1;
                result.set(right.value, left.value.length + 1);
                return {
                    type: 'logorExp',
                    value: result
                };
            },
            LogicAndExpression_logand: function (a, andLit, b) {
                var left = a.eval();
                var right = b.eval();
                var result = new Uint8Array(left.value.length + right.value.length + 1);
                result.set(left.value, 0);
                result[left.value.length] = 0xB0;
                result.set(right.value, left.value.length + 1);
                return {
                    type: 'logandExp',
                    value: result
                };
            },
            BitwiseORExpression_bor: function (a, op, b) {
                var left = a.eval();
                var right = b.eval();
                var result = new Uint8Array(left.value.length + right.value.length + 1);
                result.set(left.value, 0);
                result[left.value.length] = 0xA0;
                result.set(right.value, left.value.length + 1);
                return {
                    type: 'borExp',
                    value: result
                };
            },
            BitwiseANDExpression_band: function (a, op, b) {
                var left = a.eval();
                var right = b.eval();
                var result = new Uint8Array(left.value.length + right.value.length + 1);
                result.set(left.value, 0);
                result[left.value.length] = 0x9F;
                result.set(right.value, left.value.length + 1);
                return {
                    type: 'bandExp',
                    value: result
                };
            },
            CompareExpression_comp: function (a, op, b) {
                const ops: IOperationList = {
                    '<': 0xA4,
                    '>': 0xA5,
                    '=': 0xA6,
                    '<=': 0xA7,
                    '>=': 0xA8,
                    '<>': 0xA9
                };

                var left = a.eval();
                var right = b.eval();
                var result = new Uint8Array(left.value.length + right.value.length + 1);
                result.set(left.value, 0);
                result[left.value.length] = ops[op.sourceString];
                result.set(right.value, left.value.length + 1);
                return {
                    type: 'compExp',
                    value: result
                };
            },
            AddExpression_add: function (a, op, b) {
                const ops: IOperationList = {
                    '+': 0x9D,
                    '-': 0x9E
                };
                var left = a.eval();
                var right = b.eval();
                // TODO optimize if two numbers -> add
                var result = new Uint8Array(left.value.length + right.value.length + 1);
                result.set(left.value, 0);
                result[left.value.length] = ops[op.sourceString];
                result.set(right.value, left.value.length + 1);
                return {
                    type: 'addExp',
                    value: result
                };
            },
            MulExpression_mul: function (a, op, b) {
                const ops: IOperationList = {
                    '*': 0xA1,
                    '/': 0xA2,
                    '%': 0xA3,
                };
                var left = a.eval();
                var right = b.eval();
                // TODO optimize if two numbers -> add
                var result = new Uint8Array(left.value.length + right.value.length + 1);
                result.set(left.value, 0);
                result[left.value.length] = ops[op.sourceString];
                result.set(right.value, left.value.length + 1);
                return {
                    type: 'mulExp',
                    value: result
                };
            },
            PrefixExpression_prefix: function (op, b) {
                const ops: IOperationList = {
                    '-': 0x9E
                };
                var right = b.eval();
                var result = new Uint8Array(right.value.length + 1);
                result[0] = ops[op.sourceString];
                result.set(right.value, 1);
                return {
                    type: 'prfExp',
                    value: result
                };
            },
            ParenExpression_paren: function (leftparen, e, rightparen) {
                var inner = e.eval();
                var result = new Uint8Array(inner.value.length + 2);
                result[0] = 0x9B;
                result.set(inner.value, 1);
                result[result.length - 1] = 0x9C;
                return {
                    type: 'paren',
                    value: result
                };
            },
            RestExpression: function (e) {
                return e.eval();
            },
            Loop: function (forLit, variable, eqSign, init, dirLit, end, stepLit, step) {
                var varExp = variable.eval();
                var initExp = init.eval();
                var endExp = end.eval();
                var stepExp = step.eval()[0];

                var len = varExp.value.length + initExp.value.length + endExp.value.length + 1;
                if (stepLit.sourceString) {
                    len += stepExp.value.length + 1;
                }
                var result = new Uint8Array(len);
                var index = 0;
                result[index++] = 0x90; // TOKEN_FOR
                result[index++] = varExp.value[1]; // var without token
                result.set(initExp.value, index);
                index += initExp.value.length;
                result[index++] = dirLit.sourceString === 'to' ? 0x91 : 0x92; // TOKEN_TO, TOKEN_DOWNTO
                result.set(endExp.value, index);
                if (stepLit.sourceString) {
                    index += endExp.value.length;
                    result[index++] = 0x93; // TOKEN_STEP
                    result.set(stepExp.value, index);
                }

                return {
                    type: 'loop',
                    value: result
                };
            },
            Next: function (nextLit, e) {
                var ev = e.eval();
                var result = new Uint8Array(2);
                result[0] = 0x94;
                result[1] = ev.value[1];

                return {
                    type: 'next',
                    value: result
                };
            },
            Comparison: function (iflit, condExp, thenLit, thenStat, elseLit, elseStat) {
                var cond = condExp.eval();
                var thSt = thenStat.eval();
                var elseSt;
                if (elseLit.sourceString) {
                    elseSt = elseStat.eval()[0];
                }

                // TODO why 0 after IF token?    
                var len = cond.value.length + thSt.value.length + 3;
                if (elseSt) {
                    len += elseSt.value.length + 1;
                }
                var result = new Uint8Array(len);
                result[0] = 0x8D;
                result[1] = 0;
                var pos = 2;
                result.set(cond.value, pos);
                pos += cond.value.length;
                result[pos] = 0x8E;
                pos++;
                result.set(thSt.value, pos);
                pos += thSt.value.length;
                if (elseSt) {
                    result[1] = pos - 1;
                    result[pos] = 0x8F;
                    pos++;
                    result.set(elseSt.value, pos);
                }
                return {
                    type: 'if',
                    value: result
                };
            },
            Jump: function (jumpOp, label) {
                var result = new Uint8Array(3);
                if (jumpOp.sourceString.toLowerCase() === 'goto') {
                    result[0] = 0x95;
                } else if (jumpOp.sourceString.toLowerCase() === 'gosub') {
                    result[0] = 0x96;
                }
                var dv = new DataView(result.buffer);
                var lbl = label.eval();
                if (lbl > 0x7FFE) {
                    throw 'Label value to big. Max number allowed: 32766';
                }
                dv.setUint16(1, lbl | 0x8000, true);

                return {
                    type: 'jump',
                    value: result
                };
            },
            Delay: function (delayLit, e) {
                var ev = e.eval();
                var result = new Uint8Array(ev.value.length + 1);
                result[0] = 0x98;
                result.set(ev.value, 1);
                return {
                    type: 'delay',
                    value: result
                };
            },
            Print: function (print_lit, params) {
                var paramsEv = params.eval();
                var result = new Uint8Array(paramsEv.value.length + 1);
                result[0] = 0x8C;
                result.set(paramsEv.value, 1);

                return {
                    type: 'print',
                    value: result
                };
            },
            PrintArgs: function (first, rest) {
                var f = first.eval();
                var args, r: any = {
                    value: []
                };

                if (rest.sourceString !== '') {
                    args = rest.eval();
                    args.forEach((arg: any) => {
                        for (let i = 0; i < arg.value.length; i++) {
                            r.value.push(arg.value[i]);
                        }
                    });
                }

                var result = new Uint8Array(f.value.length + r.value.length);
                result.set(f.value, 0);
                result.set(r.value, f.value.length);

                return {
                    type: 'print_args',
                    value: result
                };
            },
            PrintArg: function (e) {
                var ev = e.eval();
                var result = new Uint8Array(ev.value);
                return {
                    type: 'print_arg',
                    value: result
                };
            },
            PrintArgsList: function (sep, arg) {
                var s = sep.eval();
                var a = arg.eval();

                var result = new Uint8Array(s.value.length + a.value.length);
                result.set(s.value, 0);
                result.set(a.value, s.value.length);
                return {
                    type: 'print_arg_list',
                    value: result
                };
            },
            PrintArgSeparator: function (e) {
                const map: IOperationList = {
                    ',': 0x99,
                    ';': 0x9A
                };
                return {
                    type: 'print_arg_sep',
                    value: new Uint8Array([map[e.sourceString]])
                };
            },
            string: function (qln1, b, qln2) {
                var strArray = b.sourceString.split('').map(c => c.charCodeAt(0));
                var result = new Uint8Array(strArray.length + 2);
                result[0] = 0x89;
                result[1] = strArray.length;
                if (strArray.length) {
                    result.set(strArray, 2);
                }
                return {
                    type: 'string',
                    value: result
                };
            },
            LibCall: function (libName, dot, funcName, leftBr, params, rightBr) {
                var paramsEv = params.eval();
                var result = new Uint8Array(paramsEv.value.length + 2);
                result[0] = lib_map[libName.sourceString.toLowerCase()].token;
                result[1] = lib_map[libName.sourceString.toLowerCase()].functions[funcName.sourceString.toLowerCase()];
                result.set(paramsEv.value, 2);

                return {
                    type: 'call',
                    value: result
                };
            },
            CallArgs(args) {
                var i, index = 0;

                if (args.sourceString !== '') {
                    var e = args.eval();
                } else {
                    e = {
                        size: 0,
                        value: []
                    };
                }

                var len = e.size || 0;
                e.value.forEach((value: {
                    type: string,
                    value: Uint8Array
                }) => {
                    len += value.value.length;
                });
                if (e.value.length) { // reserve space for commas between arguments
                    len += e.value.length - 1;
                }

                var result = new Uint8Array(len);
                for (i = 0; i < e.value.length; i++) {
                    result.set(e.value[i].value, index);
                    index += e.value[i].value.length;
                    if (i < e.value.length - 1) {
                        result[index] = 0x99;
                        index++;
                    }
                }

                return {
                    type: 'callargs',
                    value: result
                };
            },
            NonemptyListOf(first, _, rest) {
                var f = first.eval();
                var r = rest.eval();

                var result = [f].concat(r);

                return {
                    type: 'list',
                    value: result
                };
            },
            DataElems(args) {
                var i;
                var e = args.eval();

                var len = e.value.length * 2;
                var result = new Uint8Array(len);
                let dv = new DataView(result.buffer);
                for (i = 0; i < e.value.length; i++) {
                    dv.setInt16(i * 2, e.value[i], true);
                }

                return {
                    type: 'dataelems',
                    value: result
                };
            },
            DataRead: function (readLit, label, commaLit, index) {
                var lev = label.eval();
                var inev = index.eval();

                var result = new Uint8Array(3 + inev.value.length); // TOKEN 8bit, ADDR 16bit
                result[0] = 0xAF;
                var dv = new DataView(result.buffer);
                dv.setUint16(1, lev | 0x8000, true);
                result.set(inev.value, 3);

                return {
                    type: 'dataread',
                    value: result,
                    length: inev.value.length
                };
            },
            DataLine: function (optLabel, dataLit, args) {
                var label;
                if (optLabel.sourceString.length) {
                    label = optLabel.eval()[0];
                }

                var datList = args.eval();
                var result = new Uint8Array(datList.value.length);
                result.set(datList.value);

                return {
                    label: label,
                    type: 'dataline',
                    value: result
                };
            },
            value: function (e) {
                var value = e.eval();
                var result = new Uint8Array(3);
                var dv = new DataView(result.buffer);
                dv.setUint8(0, 0x88);
                dv.setInt16(1, value, true);

                return {
                    type: 'value',
                    value: result
                };
            },
            decimalValue: function (value) {
                var num = parseInt(value.sourceString, 10);
                return num;
            },
            hexValue: function (prefix, value) {
                return parseInt(value.sourceString, 16);
            },
            binaryValue: function (prefix, value) {
                return parseInt(value.sourceString, 2);
            },
            return: function (e) {
                var result = new Uint8Array(1);
                result[0] = 0x97;
                return {
                    type: 'return',
                    value: result
                };
            },
            random: function (e) {
                return {
                    type: 'random',
                    value: new Uint8Array([0xAB])
                };
            },
            endLit: function (e) {
                return {
                    type: 'end',
                    value: new Uint8Array([0x83])
                };
            },
            eol: function (_) {
                return this.sourceString;
            }
        });

        return result;
    }
}

export const ledBasicParser = new LEDBasicParser();