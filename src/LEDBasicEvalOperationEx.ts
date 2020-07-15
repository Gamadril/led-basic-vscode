'use strict';
// tslint:disable: no-bitwise

import { COLOUR_ORDER, IConfig, IError, IEvalOperation, IJumpTable, IMatchResult, IOperationList, LibMap } from './Common';
// import { dump } from './utils';

const DEBUG_STRICT = false;

let JumpTable: IJumpTable = {};
let lineNumber = 0;
let labelIdCounter = 1000;
let variableIdCounter = 0;
let errors: IError[] = [];

const labelsMap: { [label: string]: number; } = {};
const variablesMap: { [label: string]: number; } = {};

function getLabel() {
    let labelId = labelIdCounter;
    labelIdCounter++;
    if (Object.values(labelsMap).indexOf(labelId) !== -1) {
        labelId = getLabel();
    }
    return labelId;
}

function getVariable(literal: string) {
    let variableId;
    if (DEBUG_STRICT) {
        variableId = literal.charCodeAt(0) - 'a'.charCodeAt(0);
    } else {
        variableId = variableIdCounter;
        variableIdCounter++;
    }
    return variableId;
}

export const operation: IEvalOperation = {
    Program(comments, configLine, lines) {
        JumpTable = {};
        lineNumber = 1;
        errors = [];

        const coms = comments.eval();
        const conf = configLine.eval();
        const progLines = lines.eval();
        let len = 0;
        lineNumber += coms.length;
        lineNumber += conf.length;

        function getLine(i: number) {
            return comments.children.length + configLine.children.length + i;
        }

        let isInLabel = false;
        let hasData = false;
        let dataLengthPos = 0;
        // first run, calc final size and create a jump table for labels
        for (let i = 0; i < progLines.length; i++) {
            const line = progLines[i];
            const type = line.type;
            if (type === 'label') {
                const label = new DataView(line.value.buffer).getUint16(0, true) - 0x8000;
                if (JumpTable[label] !== undefined) {
                    const iLine = getLine(i);
                    errors.push({
                        message: 'Label ' + label + ' is already defined',
                        range: {
                            start: {
                                line: iLine,
                                character: 0
                            },
                            end: {
                                line: iLine,
                                character: lines.child(i).sourceString.indexOf(':')
                            }
                        }
                    });
                } else {
                    JumpTable[label] = len;
                }

                isInLabel = true;
                hasData = false;
            } else if (type === 'dataline') {
                if (!isInLabel && !line.label) {
                    const iLine = getLine(i);
                    errors.push({
                        message: 'Data definition is only possible after a label.',
                        range: {
                            start: {
                                line: iLine,
                                character: 0
                            },
                            end: {
                                line: iLine,
                                character: lines.child(i).sourceString.length
                            }
                        }
                    });
                }

                if (line.label) {
                    const label = new DataView(line.label.value.buffer).getUint16(0, true) - 0x8000;
                    if (JumpTable[label] !== undefined) {
                        const iLine = getLine(i);
                        errors.push({
                            message: 'Label ' + label + ' is already defined',
                            range: {
                                start: {
                                    line: iLine,
                                    character: 0
                                },
                                end: {
                                    line: iLine,
                                    character: lines.child(i).sourceString.indexOf(':')
                                }
                            }
                        });
                    } else {
                        JumpTable[label] = len;
                    }

                    isInLabel = true;
                    hasData = false;
                    len += 3; // label bytes length
                }

                if (!hasData) {
                    len += 2; // line number
                    len += 2; // length of all data and data token
                    hasData = true;
                }
            } else if (type === 'return') {
                if (!isInLabel) {
                    const iLine = getLine(i);
                    errors.push({
                        message: 'return requires a label to return from',
                        range: {
                            start: {
                                line: iLine,
                                character: 0
                            },
                            end: {
                                line: iLine,
                                character: lines.child(i).sourceString.length
                            }
                        }
                    });

                }
                len += 2; // line number and length
            } else if (type !== 'emptyline') {
                hasData = false;
                // isInLabel = false;
                len += 2; // line number and length
            }
            len += line.value.length;
        }

        const result = new Uint8Array(len + 2); // +2 = 0xFFFF end of stream
        const dv = new DataView(result.buffer);

        len = 0;
        isInLabel = false;
        hasData = false;
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < progLines.length; i++) {
            const line = progLines[i];
            const val = line.value;
            const type = line.type;
            const label = line.label;

            if (type === 'emptyline') {
                lineNumber++;
                continue;
            }

            if (type === 'dataline') {
                if (label) {
                    hasData = false;
                }

                if (!hasData) {
                    if (label) {
                        result.set(label.value, len);
                        len += label.value.length;
                    }
                    hasData = true;
                    dv.setUint16(len, lineNumber, true);
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
                lineNumber++;
                // console.log(Utils.dump(result));
                continue;
            } else if (type === 'label') {
                hasData = false;
            } else {
                // check for jumps and dataread
                for (let j = 0; j < val.length; j++) {
                    if ((val[j] === 0x95 || val[j] === 0x96 || val[j] === 0xAF) && j < val.length - 2) {
                        const locdv = new DataView(val.buffer);
                        const labelNr = locdv.getUint16(j + 1, true);
                        if (labelNr & 0x8000) {
                            let addr = JumpTable[labelNr - 0x8000];
                            if (addr) {
                                if (val[j] === 0xAF) {
                                    addr += 5;
                                }
                                locdv.setUint16(j + 1, addr, true);
                            }
                        }
                    }
                }

                dv.setUint16(len, lineNumber, true);
                len += 2;
            }

            result.set(val, len);
            len += val.length;
            lineNumber++;
        }

        result.set([0xFF, 0xFF], len);

        if (errors.length) {
            const errorResult: IMatchResult = {
                success: false,
                errors
            };
            return errorResult;
        }

        return {
            success: true,
            code: result,
            config: conf[0] || {}
        };
    },
    configLine(a, b, lnbr) {
        const cparams = b.sourceString.trim().split(' ');
        const result: IConfig = {};
        let cfgId;
        let cfgParam;

        cparams.forEach((elem: string) => {
            cfgId = elem.substr(0, 1);
            cfgParam = elem.substring(1);

            if (cfgId === 'L') {
                result.ledcnt = parseInt(cfgParam, 10);
            } else if (cfgId === 'C') {
                if (cfgParam === 'RGB') {
                    result.colour_order = COLOUR_ORDER.RGB;
                    result.white = false;
                } else if (cfgParam === 'GRB') {
                    result.colour_order = COLOUR_ORDER.GRB;
                    result.white = false;
                } else if (cfgParam === 'GRBW') {
                    result.colour_order = COLOUR_ORDER.GRB;
                    result.white = true;
                } else if (cfgParam === 'RGBW') {
                    result.colour_order = COLOUR_ORDER.RGB;
                    result.white = true;
                }
            } else if (cfgId === 'M') {
                result.mbr = parseInt(cfgParam, 10);
            } else if (cfgId === 'P') {
                result.gprint = cfgParam === '0' ? false : true;
            } else if (cfgId === 'S') {
                result.sys_led = parseInt(cfgParam, 10);
            } else if (elem.startsWith('T')) {
                result.led_type = parseInt(cfgParam, 10);
            } else if (elem.startsWith('A')) {
                result.spi_rate = parseInt(cfgParam, 10);
            } else if (elem.startsWith('F')) {
                result.frame_rate = parseInt(cfgParam, 10);
            }
        });
        return result;
    },
    emptyLine(e, eol) {
        return {
            type: 'emptyline',
            value: new Uint8Array(0)
        };
    },
    Line(e, comment, eol) {
        let result;
        const ev = e.eval();
        if (ev.type === 'label' || ev.type === 'dataline') {
            result = new Uint8Array(ev.value.length);
            result.set(ev.value, 0);
        } else {
            result = new Uint8Array(ev.value.length + 1);
            result[0] = ev.value.length;
            result.set(ev.value, 1);
        }

        const line = {
            type: ev.type,
            value: result,
            label: undefined
        };
        if (ev.label) {
            line.label = ev.label;
        }
        return line;
    },
    Statement(e) {
        const ev = e.eval();
        const result = new Uint8Array(ev.value.length);
        result.set(ev.value, 0);
        return {
            type: ev.type,
            value: result
        };
    },
    LabelIdentifier(labelLit) {
        return labelLit.sourceString;
    },
    Label(e, colon) {
        const ev = e.eval();
        let label = parseInt(ev, 10);
        if (isNaN(label)) {
            label = getLabel();
            labelsMap[ev] = label;
        }

        if (label > 0x7FFE) {
            throw new Error('Label value to big. Max number allowed: 32766');
        }

        const result = new Uint8Array(3);
        const dv = new DataView(result.buffer);
        // tslint:disable-next-line: no-bitwise
        dv.setUint16(0, label | 0x8000, true);
        result[2] = 0;

        return {
            type: 'label',
            value: result
        };
    },
    variable(e) {
        const variableLit = e.sourceString;
        let variable = variablesMap[variableLit];
        if (variable === undefined) {
            variable = getVariable(variableLit);
            variablesMap[variableLit] = variable;
        }
        const result = new Uint8Array(2);
        result[0] = 0x8A;
        result[1] = variable;
        return {
            type: 'var',
            value: result
        };
    },
    Assignment(letLit, left, equalSign, right) {
        const rightSide = right.eval();
        const variableLit = left.sourceString;

        let variable = variablesMap[variableLit];
        if (variable === undefined) {
            variable = getVariable(variableLit);
            variablesMap[variableLit] = variable;
        }

        const result = new Uint8Array(rightSide.value.length + 1 + 1);
        result[0] = 0x8B;
        result[1] = variable;
        result.set(rightSide.value, 2);

        return {
            type: 'assign',
            value: result
        };
    },
    Expression(e) {
        return e.eval();
    },
    LogicOrExpression_logor(a, orLit, b) {
        const left = a.eval();
        const right = b.eval();
        const result = new Uint8Array(left.value.length + right.value.length + 1);
        result.set(left.value, 0);
        result[left.value.length] = 0xB1;
        result.set(right.value, left.value.length + 1);
        return {
            type: 'logorExp',
            value: result
        };
    },
    LogicAndExpression_logand(a, andLit, b) {
        const left = a.eval();
        const right = b.eval();
        const result = new Uint8Array(left.value.length + right.value.length + 1);
        result.set(left.value, 0);
        result[left.value.length] = 0xB0;
        result.set(right.value, left.value.length + 1);
        return {
            type: 'logandExp',
            value: result
        };
    },
    BitwiseORExpression_bor(a, op, b) {
        const left = a.eval();
        const right = b.eval();
        const result = new Uint8Array(left.value.length + right.value.length + 1);
        result.set(left.value, 0);
        result[left.value.length] = 0xA0;
        result.set(right.value, left.value.length + 1);
        return {
            type: 'borExp',
            value: result
        };
    },
    BitwiseANDExpression_band(a, op, b) {
        const left = a.eval();
        const right = b.eval();
        const result = new Uint8Array(left.value.length + right.value.length + 1);
        result.set(left.value, 0);
        result[left.value.length] = 0x9F;
        result.set(right.value, left.value.length + 1);
        return {
            type: 'bandExp',
            value: result
        };
    },
    CompareExpression_comp(a, op, b) {
        const ops: IOperationList = {
            '<': 0xA4,
            '>': 0xA5,
            '=': 0xA6,
            '<=': 0xA7,
            '>=': 0xA8,
            '<>': 0xA9
        };

        const left = a.eval();
        const right = b.eval();
        const result = new Uint8Array(left.value.length + right.value.length + 1);
        result.set(left.value, 0);
        result[left.value.length] = ops[op.sourceString];
        result.set(right.value, left.value.length + 1);
        return {
            type: 'compExp',
            value: result
        };
    },
    AddExpression_add(a, op, b) {
        const ops: IOperationList = {
            '+': 0x9D,
            '-': 0x9E
        };
        const left = a.eval();
        const right = b.eval();
        // TODO optimize if two numbers -> add
        const result = new Uint8Array(left.value.length + right.value.length + 1);
        result.set(left.value, 0);
        result[left.value.length] = ops[op.sourceString];
        result.set(right.value, left.value.length + 1);
        return {
            type: 'addExp',
            value: result
        };
    },
    MulExpression_mul(a, op, b) {
        const ops: IOperationList = {
            '*': 0xA1,
            '/': 0xA2,
            '%': 0xA3,
        };
        const left = a.eval();
        const right = b.eval();
        // TODO optimize if two numbers -> add
        const result = new Uint8Array(left.value.length + right.value.length + 1);
        result.set(left.value, 0);
        result[left.value.length] = ops[op.sourceString];
        result.set(right.value, left.value.length + 1);
        return {
            type: 'mulExp',
            value: result
        };
    },
    PrefixExpression_prefix(op, b) {
        const ops: IOperationList = {
            '-': 0x9E
        };
        const right = b.eval();
        const result = new Uint8Array(right.value.length + 1);
        result[0] = ops[op.sourceString];
        result.set(right.value, 1);
        return {
            type: 'prfExp',
            value: result
        };
    },
    ParenExpression_paren(leftparen, e, rightparen) {
        const inner = e.eval();
        const result = new Uint8Array(inner.value.length + 2);
        result[0] = 0x9B;
        result.set(inner.value, 1);
        result[result.length - 1] = 0x9C;
        return {
            type: 'paren',
            value: result
        };
    },
    RestExpression(e) {
        return e.eval();
    },
    Loop(forLit, variable, eqSign, init, dirLit, end, stepLit, step) {
        const varExp = variable.eval();
        const initExp = init.eval();
        const endExp = end.eval();
        const stepExp = step.eval()[0];

        let len = varExp.value.length + initExp.value.length + endExp.value.length + 1;
        if (stepLit.sourceString) {
            len += stepExp.value.length + 1;
        }
        const result = new Uint8Array(len);
        let index = 0;
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
    Next(nextLit, e) {
        const ev = e.eval();
        const result = new Uint8Array(2);
        result[0] = 0x94;
        result[1] = ev.value[1];

        return {
            type: 'next',
            value: result
        };
    },
    Comparison(iflit, condExp, thenLit, thenStat, elseLit, elseStat) {
        const cond = condExp.eval();
        const thSt = thenStat.eval();
        let elseSt;
        if (elseLit.sourceString) {
            elseSt = elseStat.eval()[0];
        }

        // TODO why 0 after IF token?
        let len = cond.value.length + thSt.value.length + 3;
        if (elseSt) {
            len += elseSt.value.length + 1;
        }
        const result = new Uint8Array(len);
        result[0] = 0x8D;
        result[1] = 0;
        let pos = 2;
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
    Jump(jumpOp, labelLit) {
        const result = new Uint8Array(3);
        if (jumpOp.sourceString.toLowerCase() === 'goto') {
            result[0] = 0x95;
        } else if (jumpOp.sourceString.toLowerCase() === 'gosub') {
            result[0] = 0x96;
        }
        const dv = new DataView(result.buffer);
        const lbl = labelLit.eval();
        let label = parseInt(lbl, 10);
        if (isNaN(label)) {
            label = labelsMap[lbl];
        }

        if (lbl > 0x7FFE) {
            throw new Error('Label value to big. Max number allowed: 32766');
        }
        dv.setUint16(1, lbl | 0x8000, true);

        return {
            type: 'jump',
            value: result
        };
    },
    Delay(delayLit, e) {
        const ev = e.eval();
        const result = new Uint8Array(ev.value.length + 1);
        result[0] = 0x98;
        result.set(ev.value, 1);
        return {
            type: 'delay',
            value: result
        };
    },
    Print(printlit, params) {
        const paramsEv = params.eval();
        const result = new Uint8Array(paramsEv.value.length + 1);
        result[0] = 0x8C;
        result.set(paramsEv.value, 1);

        return {
            type: 'print',
            value: result
        };
    },
    PrintArgs(first, rest) {
        const f = first.eval();
        let args;
        const r: any = {
            value: []
        };

        if (rest.sourceString !== '') {
            args = rest.eval();
            args.forEach((arg: any) => {
                arg.value.forEach((sarg: any) => {
                    r.value.push(sarg);
                });
            });
        }

        const result = new Uint8Array(f.value.length + r.value.length);
        result.set(f.value, 0);
        result.set(r.value, f.value.length);

        return {
            type: 'print_args',
            value: result
        };
    },
    PrintArg(e) {
        const ev = e.eval();
        const result = new Uint8Array(ev.value);
        return {
            type: 'print_arg',
            value: result
        };
    },
    PrintArgsList(sep, arg) {
        const s = sep.eval();
        const a = arg.eval();

        const result = new Uint8Array(s.value.length + a.value.length);
        result.set(s.value, 0);
        result.set(a.value, s.value.length);
        return {
            type: 'print_arg_list',
            value: result
        };
    },
    PrintArgSeparator(e) {
        const map: IOperationList = {
            ',': 0x99,
            ';': 0x9A
        };
        return {
            type: 'print_arg_sep',
            value: new Uint8Array([map[e.sourceString]])
        };
    },
    string(qln1, b, qln2) {
        const strArray = b.sourceString.split('').map((c: string) => c.charCodeAt(0));
        const result = new Uint8Array(strArray.length + 2);
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
    LibCall(libName, dot, funcName, leftBr, params, rightBr) {
        const paramsEv = params.eval();
        const result = new Uint8Array(paramsEv.value.length + 2);
        result[0] = LibMap[libName.sourceString.toLowerCase()].token;
        result[1] = LibMap[libName.sourceString.toLowerCase()].functions[funcName.sourceString.toLowerCase()];
        result.set(paramsEv.value, 2);

        return {
            type: 'call',
            value: result
        };
    },
    CallArgs(args) {
        let index = 0;
        let e;

        if (args.sourceString !== '') {
            e = args.eval();
        } else {
            e = {
                size: 0,
                value: []
            };
        }

        let len = e.size || 0;
        e.value.forEach((value: {
            type: string,
            value: Uint8Array
        }) => {
            len += value.value.length;
        });
        if (e.value.length) { // reserve space for commas between arguments
            len += e.value.length - 1;
        }

        const result = new Uint8Array(len);
        for (let i = 0; i < e.value.length; i++) {
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
        const f = first.eval();
        const r = rest.eval();

        const result = [f].concat(r);

        return {
            type: 'list',
            value: result
        };
    },
    DataElems(args) {
        const e = args.eval();

        const len = e.value.length * 2;
        const result = new Uint8Array(len);
        const dv = new DataView(result.buffer);
        for (let i = 0; i < e.value.length; i++) {
            dv.setInt16(i * 2, e.value[i], true);
        }

        return {
            type: 'dataelems',
            value: result
        };
    },
    DataRead(readLit, labelLit, commaLit, index) {
        const lbl = labelLit.eval();
        const inev = index.eval();

        let label = parseInt(lbl, 10);
        if (isNaN(label)) {
            label = labelsMap[lbl];
        }

        const result = new Uint8Array(3 + inev.value.length); // TOKEN 8bit, ADDR 16bit
        result[0] = 0xAF;
        const dv = new DataView(result.buffer);
        dv.setUint16(1, label | 0x8000, true);
        result.set(inev.value, 3);

        return {
            type: 'dataread',
            value: result,
            length: inev.value.length
        };
    },
    DataLine(optLabel, dataLit, args, comma) {
        let label;
        if (optLabel.sourceString.length) {
            label = optLabel.eval()[0];
        }

        const datList = args.eval();
        const result = new Uint8Array(datList.value.length);
        result.set(datList.value);

        return {
            label,
            type: 'dataline',
            value: result
        };
    },
    value(e) {
        const value = e.eval();
        const result = new Uint8Array(3);
        const dv = new DataView(result.buffer);
        dv.setUint8(0, 0x88);
        dv.setInt16(1, value, true);

        return {
            type: 'value',
            value: result
        };
    },
    decimalValue(value) {
        const num = parseInt(value.sourceString, 10);
        return num;
    },
    hexValue(prefix, value) {
        return parseInt(value.sourceString, 16);
    },
    binaryValue(prefix, value) {
        return parseInt(value.sourceString, 2);
    },
    Return(e) {
        const result = new Uint8Array(1);
        result[0] = 0x97;
        return {
            type: 'return',
            value: result
        };
    },
    Random(e) {
        return {
            type: 'random',
            value: new Uint8Array([0xAB])
        };
    },
    endLit(e) {
        return {
            type: 'end',
            value: new Uint8Array([0x83])
        };
    },
    eol(_) {
        return this.sourceString;
    }
};
