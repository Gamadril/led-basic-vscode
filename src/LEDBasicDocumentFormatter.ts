'use strict';

import * as fs from 'fs';
import * as ohm from 'ohm-js';
import { getExtensionPath } from './utils';

import { CancellationToken, DocumentFormattingEditProvider, FormattingOptions, TextDocument, TextEdit } from 'vscode';

const GRAMMAR_EX = 'grammar_ex.ohm';
// const GRAMMAR = 'grammar.ohm';

let gOptions!: FormattingOptions;

export class LEDBasicDocumentFormatter implements DocumentFormattingEditProvider {
    private grammar: ohm.Grammar;
    private semantics: ohm.Semantics;

    constructor() {
        const path = getExtensionPath() + 'res/' + GRAMMAR_EX;
        const grammar = fs.readFileSync(path).toString();

        this.grammar = ohm.grammar(grammar);
        this.semantics = this.createSemantics();
    }

    public provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): TextEdit[] | Thenable<TextEdit[] | null | undefined> | null | undefined {
        const result: TextEdit[] = [];

        gOptions = options;

        const code = document.getText();
        const formCode: string[] = this.semantics(this.grammar.match(code)).eval();

        for (let index = 0; index < document.lineCount; index++) {
            const line = document.lineAt(index);
            const formattedLine = formCode[index];
            if (line.text && line.text !== formattedLine) {
                result.push(TextEdit.replace(line.range, formattedLine));
            }
        }
        return result;
    }

    /**
     * Build local semantics for generating tokenized output for the target device
     */
    private createSemantics() {
        const result = this.grammar.createSemantics();
        let deep = 0;
        let goDeeper = false;

        function opExp(left: ohm.Node, op: ohm.Node, right: ohm.Node) {
            const res = [
                left.eval(),
                op.sourceString,
                right.eval()
            ];
            return res.join(' ');
        }

        result.addOperation('eval', {
            Program(comments, configLine, lines) {
                deep = 0;
                let res: string[] = []; // formatted code
                const coms = comments.eval();
                const conf = configLine.eval();
                const main = lines.eval();

                res = res.concat(coms).concat(conf).concat(main);
                return res;
            },
            configLine(a, b, lnbr) {
                return a.sourceString + ' ' + b.sourceString.trim().split(' ').filter((e) => e ? true : false).join(' ');
            },
            emptyLine(e, eol) {
                return e.sourceString;
            },
            Line(e, comment, eol) {
                let ev = e.eval();
                if (comment.sourceString) {
                    ev += '  ' + comment.sourceString;
                }

                let prefix = '';
                if (deep) {
                    prefix = prefix + ' '.repeat(gOptions.tabSize * deep);
                }

                const res = prefix + ev;

                if (goDeeper) {
                    goDeeper = false;
                    deep++;
                }

                return res;
            },
            Statement(e) {
                return e.eval();
            },
            LabelIdentifier(e) {
                return e.sourceString;
            },
            Label(labelLit, colon) {
                deep = 0;
                goDeeper = true;
                return labelLit.sourceString + colon.sourceString;
            },
            variable(e) {
                return e.sourceString;
            },
            Assignment(letLit, left, equalSign, right) {
                const res = [];
                if (letLit.sourceString) {
                    res.push(letLit.sourceString);
                }
                res.push(left.sourceString);
                res.push(equalSign.sourceString);
                res.push(right.eval());
                return res.join(' ');
            },
            Expression(e) {
                return e.eval();
            },
            LogicOrExpression_logor: opExp,
            LogicAndExpression_logand: opExp,
            BitwiseORExpression_bor: opExp,
            BitwiseANDExpression_band: opExp,
            CompareExpression_comp: opExp,
            AddExpression_add: opExp,
            MulExpression_mul: opExp,
            PrefixExpression_prefix(op, b) {
                return op.sourceString + b.eval();
            },
            ParenExpression_paren(leftparen, e, rightparen) {
                return [
                    leftparen.sourceString,
                    e.eval(),
                    rightparen.sourceString
                ].join('');
            },
            RestExpression(e) {
                return e.eval();
            },
            Loop(forLit, variable, eqSign, init, dirLit, end, stepLit, step) {
                let res = forLit.sourceString + ' ' + variable.sourceString + ' ' + eqSign.sourceString + ' ' + init.sourceString + ' ' + dirLit.sourceString + ' ' + end.sourceString;
                if (stepLit.sourceString) {
                    // FIXME ohm bug? stepLit and step of type _iter and same value "step XX"
                    // res = res + stepLit.sourceString + ' ' + step.sourceString;
                    res = res + stepLit.sourceString;
                }
                goDeeper = true;
                return res;
            },
            Next(nextLit, e) {
                deep--;
                return nextLit.sourceString + ' ' + e.sourceString;
            },
            Comparison(iflit, condExp, thenLit, thenStat, elseLit, elseStat) {
                const res = [];
                const ce = condExp.eval();
                const te = thenStat.eval().trim();
                res.push(iflit.sourceString);
                res.push(ce);
                if (thenLit.sourceString) {
                    res.push(thenLit.sourceString);
                }
                res.push(te);
                if (elseLit.sourceString) {
                    res.push('else');
                    const ee = elseStat.eval()[0].trim();
                    res.push(ee);
                }

                return res.join(' ');
            },
            Jump(jumpOp, label) {
                return jumpOp.sourceString + ' ' + label.sourceString;
            },
            Delay(delayLit, e) {
                return delayLit.sourceString + ' ' + e.eval();
            },
            Print(printLit, params) {
                return printLit.sourceString + ' ' + params.eval();
            },
            PrintArgs(first, rest) {
                const fev = first.eval();
                const rev = rest.eval();
                return fev + rev.join('');
            },
            PrintArg(e) {
                return e.sourceString;
            },
            PrintArgsList(sep, arg) {
                const av = arg.eval();
                return sep.sourceString + av;
            },
            LibCall(libName, dot, funcName, leftBr, params, rightBr) {
                let res = libName.sourceString.toUpperCase() + dot.sourceString + funcName.sourceString.toLowerCase() + leftBr.sourceString;
                const ev = params.eval();
                res += ev + rightBr.sourceString;
                return res;
            },
            CallArgs(args) {
                if (!args.sourceString) {
                    return '';
                }
                const ev = args.eval();
                return ev.join(', ');
            },
            NonemptyListOf(first, _, rest) {
                const f = first.eval();
                const r = rest.eval();

                const res = [f].concat(r);
                return res;
            },
            DataElems(args) {
                return args.eval().join(', ');
            },
            DataRead(readLit, label, commaLit, index) {
                let res = readLit.sourceString + ' ';
                res += label.eval() + commaLit.sourceString + ' ';
                res += index.eval();
                return res;
            },
            DataLine(optLabel, dataLit, args, comma) {
                deep = 0;
                const res = [];
                const av = args.eval();
                if (optLabel.sourceString) {
                    res.push(optLabel.sourceString);
                }
                res.push(dataLit.sourceString);
                res.push(av);

                return res.join(' ');
            },
            value(e) {
                return e.eval();
            },
            decimalValue(value) {
                return this.sourceString;
            },
            hexValue(prefix, value) {
                return this.sourceString;
            },
            binaryValue(prefix, value) {
                return this.sourceString;
            },
            Return(e) {
                return e.sourceString;
            },
            Random(e) {
                return e.sourceString;
            },
            endLit(e) {
                deep = 0;
                return e.sourceString;
            },
            eol(_) {
                return this.sourceString;
            }
        });

        return result;
    }
}
