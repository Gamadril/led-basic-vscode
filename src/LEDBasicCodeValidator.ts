'use strict';

import { DiagnosticCollection, Diagnostic, DiagnosticSeverity, Range, TextDocument, Position } from "vscode";
import { deviceSelector } from "./DeviceSelector";
import { LEDBasicParserFactory } from "./LEDBasicParserFactory";
import { IError, IRange } from "./Common";

function IRange2Range(range: IRange) {
    let result : Range = new Range(
        new Position(range.start.line, range.start.character),
        new Position(range.end.line, range.end.character)
    );
    return result;
}

export class LEDBasicCodeValidator {
    private _runner: NodeJS.Timer | null = null;
    private _diagnosticCollection: DiagnosticCollection;

    constructor(diagnosticCollection: DiagnosticCollection) {
        this._diagnosticCollection = diagnosticCollection;
    }

    dispose() {
        this._diagnosticCollection.dispose();
        if (this._runner !== null) {
            clearTimeout(this._runner);
            this._runner = null;
        }
    }

    /**
     * Validates the provided document. The validation itself is executed after a delay if no other calls were registered in thea period of time
     * @param doc - Textdocument object of the current file
     */
    validate(doc: TextDocument) {
        if (doc.isUntitled) {
            return;
        }
        if (doc.languageId !== 'led_basic') {
            return;
        }
        if (this._runner !== null) {
            clearTimeout(this._runner);
        }
        this._runner = setTimeout(() => {
            let result = this.processFile(doc);
            if (!result) {
                // commands.executeCommand("workbench.action.problems.focus");
            }
            this._runner = null;
        }, 1000);
    }

    /**
     * Validates the provided document immeditaely and returns the resul of the validation.
     * @param doc - Textdocument object of the current file
     */

    validateNow(doc: TextDocument) {
        return this.processFile(doc);
    }

    /**
     * Validates the code file and generates error messages for the "PROBLEMS" view
     * @param doc - Textdocument object of the current file
     */
    private processFile(doc: TextDocument): boolean {
        this._diagnosticCollection.clear();

        let sourceCode = doc.getText();
        let parser = LEDBasicParserFactory.getParser();
        let matchResult = parser.match(sourceCode);

        if (!matchResult.success && matchResult.errors) {
            let diagnostics = matchResult.errors.map((error: IError) => {
                return new Diagnostic(IRange2Range(error.range), error.message, DiagnosticSeverity.Error)
            });
            this._diagnosticCollection.set(doc.uri, diagnostics);
            return false;
        } else {
            try {
                matchResult = parser.match(sourceCode);
            } catch (e) {
                console.log(e);
            }

            let diagnostics: Diagnostic[] = [];

            if (!matchResult.success && matchResult.errors) {
                diagnostics.concat(matchResult.errors.map((error: IError) => {
                    return new Diagnostic(IRange2Range(error.range), error.message, DiagnosticSeverity.Error)
                }));
            }

            // check for illegal API usage
            let currentDevice = deviceSelector.selectedDevice();
            let line;
            let m;
            let reg = new RegExp('((?:IO|LED)\\.([a-zA-Z]+))', 'gim');
            for (let index = 0; index < doc.lineCount; index++) {
                line = doc.lineAt(index);
                // skip line if empty or is a comment
                if (line.isEmptyOrWhitespace || line.text.trim().startsWith('\'')) {
                    continue;
                }

                while (m = reg.exec(line.text)) {
                    let funcName = m[2];
                    //let args = m[3];
                    let cmd = currentDevice.commands.find(cmd => { return cmd.name === funcName });
                    if (!cmd) {
                        let start = new Position(index, m.index);
                        let end = new Position(index, m.index + m[1].length);
                        let diagnostic = new Diagnostic(new Range(start, end), 'Command "' + m[1] + '" is not supported by current device', DiagnosticSeverity.Error);
                        diagnostics.push(diagnostic);
                    } else {
                        // TODO find a propper regex if possible
                        // get the arguments
                        let args = '';
                        let bs = 0;
                        let offset = m.index + m[1].length;
                        let c;
                        while (offset < line.text.length) {
                            c = line.text.charAt(offset);
                            if (c !== '(' && bs === 0) {
                                break;
                            }
                            if (c === '(') {
                                bs++;
                            } else if (c === ')') {
                                bs--;
                            }
                            args += c;
                            offset++;
                        }
                        args = args.substr(1, args.length - 2);

                        let ac = args ? args.split(',').length : 0;
                        if (ac !== cmd.argcount) {
                            let start = new Position(index, m.index);
                            let end = new Position(index, m.index + m[1].length);
                            let diagnostic = new Diagnostic(new Range(start, end), 'Command "' + m[1] + '" has wrong number of arguments', DiagnosticSeverity.Error);
                            diagnostics.push(diagnostic);
                        }
                    }
                }
            }

            if (diagnostics.length) {
                this._diagnosticCollection.set(doc.uri, diagnostics);
                return false;
            }

            return true;
        }
    }
}