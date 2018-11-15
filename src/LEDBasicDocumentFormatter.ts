import * as ohm from "ohm-js";
import * as fs from "fs";
import { getExtensionPath } from "./utils";

import { DocumentFormattingEditProvider, TextDocument, FormattingOptions, CancellationToken, TextEdit } from "vscode";

'use strict';

var _options!: FormattingOptions;

export class LEDBasicDocumentFormatter implements DocumentFormattingEditProvider {
    private _grammar: ohm.Grammar;
    private _semantics: ohm.Semantics;

    constructor() {
        let grammar = fs.readFileSync(getExtensionPath() + 'res/grammar.ohm').toString();

        this._grammar = ohm.grammar(grammar);
        this._semantics = this.createSemantics();
    }

    /**
     * Build local semantics for generating tokenized output for the target device
     */
    private createSemantics() {
        let result = this._grammar.createSemantics();
        let deep = 0;
        let goDeeper = false;

        function opExp(left: ohm.Node, op: ohm.Node, right: ohm.Node) {
            var result = [
                left.eval(),
                op.sourceString,
                right.eval()
            ];
            return result.join(' ');
        }

        result.addOperation('eval', {
            Program: function (comments, configLine, lines) {
                deep = 0;
                var result: string[] = []; // formatted code
                var coms = comments.eval();
                var conf = configLine.eval();
                var main = lines.eval();

                result = result.concat(coms).concat(conf).concat(main);

                return result;
            },
            configLine: function (a, b, lnbr) {
                return a.sourceString + ' ' + b.sourceString.trim().split(' ').filter(e => { return e ? true : false }).join(' ');
            },
            emptyLine: function (e, eol) {
                return e.sourceString;
            },
            Line: function (e, comment, eol) {
                
                var ev = e.eval();
                if (comment.sourceString) {
                    ev += '  ' + comment.sourceString;
                }

                var prefix = '';
                if (deep) {
                    prefix = prefix + ' '.repeat(_options.tabSize * deep);
                }

                var result = prefix + ev;

                if (goDeeper) {
                    goDeeper = false;
                    deep++;
                }

                return result;
            },
            Statement: function (e) {
                return e.eval();
            },
            Label: function (labelLit, colon) {
                deep = 0;
                goDeeper = true;
                return labelLit.sourceString + colon.sourceString;
            },
            variableDecl: function (e) {
                return e.sourceString;
            },
            variable: function (e) {
                return e.sourceString;
            },
            Assignment: function (letLit, left, equalSign, right) {
                var result = [];
                if (letLit.sourceString) {
                    result.push(letLit.sourceString);
                }
                result.push(left.sourceString);
                result.push(equalSign.sourceString)
                result.push(right.eval());
                return result.join(' ');
            },
            Expression: function (e) {
                return e.eval();
            },
            LogicOrExpression_logor: opExp,
            LogicAndExpression_logand: opExp,
            BitwiseORExpression_bor: opExp,
            BitwiseANDExpression_band: opExp,
            CompareExpression_comp: opExp,
            AddExpression_add: opExp,
            MulExpression_mul: opExp,
            PrefixExpression_prefix: function (op, b) {
                return op.sourceString + b.eval();
            },
            ParenExpression_paren: function (leftparen, e, rightparen) {
                return [
                    leftparen.sourceString,
                    e.eval(),
                    rightparen.sourceString
                ].join('');
            },
            RestExpression: function (e) {
                return e.eval();
            },
            Loop: function (forLit, variable, eqSign, init, dirLit, end, stepLit, step) {
                var result = forLit.sourceString + ' ' + variable.sourceString + ' ' + eqSign.sourceString + ' ' + init.sourceString + ' ' + dirLit.sourceString + ' ' + end.sourceString;
                if (stepLit.sourceString) {
                    result = result + stepLit.sourceString + ' ' + step.sourceString;
                }
                goDeeper = true;
                return result;
            },
            Next: function (nextLit, e) {
                deep--;
                return nextLit.sourceString + ' ' + e.sourceString;
            },
            Comparison: function (iflit, condExp, thenLit, thenStat, elseLit, elseStat) {
                var result = [];
                var ce = condExp.eval();
                var te = thenStat.eval().trim();
                result.push(iflit.sourceString);
                result.push(ce);
                if (thenLit.sourceString) {
                    result.push(thenLit.sourceString);
                }
                result.push(te);
                if (elseLit.sourceString) {
                    result.push('else');
                    let ee = elseStat.eval()[0].trim();
                    result.push(ee);
                }

                return result.join(' ');
            },
            Jump: function (jumpOp, label) {
                return jumpOp.sourceString + ' ' + label.sourceString;
            },
            Delay: function (delayLit, e) {
                return delayLit.sourceString + ' ' + e.eval();
            },
            Print: function (print_lit, params) {
                return print_lit.sourceString + ' ' + params.eval();
            },
            PrintArgs: function (first, rest) {
                var fev = first.eval();
                var rev = rest.eval();
                return fev + rev.join('');
            },
            PrintArg: function (e) {
                return e.sourceString;
            },
            PrintArgsList: function (sep, arg) {
                var av = arg.eval();
                return sep.sourceString + av;
            },
            LibCall: function (libName, dot, funcName, leftBr, params, rightBr) {
                var result = libName.sourceString.toUpperCase() + dot.sourceString + funcName.sourceString.toLowerCase() + leftBr.sourceString;
                var ev = params.eval();
                result += ev + rightBr.sourceString;
                return result;
            },
            CallArgs(args) {
                if (!args.sourceString) {
                    return '';
                }
                let ev = args.eval();
                return ev.join(', ');
            },
            NonemptyListOf(first, _, rest) {
                var f = first.eval();
                var r = rest.eval();

                var result = [f].concat(r);
                return result;
            },
            DataElems(args) {
                return args.eval().join(', ');
            },
            DataRead: function (readLit, label, commaLit, index) {
                var result = readLit.sourceString + ' ';
                result += label.eval() + commaLit.sourceString + ' ';
                result += index.eval();
                return result;
            },
            DataLine: function (optLabel, dataLit, args) {
                deep = 0;
                var result = [];
                var av = args.eval();
                if (optLabel.sourceString) {
                    result.push(optLabel.sourceString);
                }
                result.push(dataLit.sourceString);
                result.push(av);

                return result.join(' ');
            },
            value: function (e) {
                return e.eval();
            },
            decimalValue: function (value) {
                return this.sourceString;
            },
            hexValue: function (prefix, value) {
                return this.sourceString;
            },
            binaryValue: function (prefix, value) {
                return this.sourceString;
            },
            return: function (e) {
                return e.sourceString;
            },
            random: function (e) {
                return e.sourceString;
            },
            endLit: function (e) {
                deep = 0;
                return e.sourceString;
            },
            eol: function (_) {
                return this.sourceString;
            }
        });

        return result;
    }


    provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): TextEdit[] | Thenable<TextEdit[] | null | undefined> | null | undefined {
        var result: TextEdit[] = [];

        _options = options;

        var code = document.getText()
        var formCode: string[] = this._semantics(this._grammar.match(code)).eval();

        for (let index = 0; index < document.lineCount; index++) {
            let line = document.lineAt(index);
            let formattedLine = formCode[index];
            if (line.text && line.text !== formattedLine) {
                //console.log('[', index, ']: ', line.text, ' > ', formattedLine);
                result.push(TextEdit.replace(line.range, formattedLine));
            }
        }
        return result;
    }
}