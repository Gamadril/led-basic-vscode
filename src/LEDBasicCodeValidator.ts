'use strict';

import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Position, Range, TextDocument, workspace } from 'vscode';
import { IError, IRange, IMatchResult } from './Common';
import { deviceSelector } from './DeviceSelector';
import { LEDBasicParserFactory } from './LEDBasicParserFactory';

function IRange2Range(range: IRange) {
    const result: Range = new Range(
        new Position(range.start.line, range.start.character),
        new Position(range.end.line, range.end.character)
    );
    return result;
}

export class LEDBasicCodeValidator {
    private runner: NodeJS.Timer | null = null;
    private diagnosticCollection: DiagnosticCollection;

    constructor(diagnosticCollection: DiagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;
    }

    public dispose() {
        if (this.runner !== null) {
            clearTimeout(this.runner);
            this.runner = null;
        }
    }

    /**
     * Validates the provided document. The validation itself is executed after a delay if no other calls were registered in thea period of time
     * @param doc - Textdocument object of the current file
     */
    public validate(doc: TextDocument) {
        if (doc.isUntitled) {
            return;
        }
        if (doc.languageId !== 'led_basic') {
            return;
        }
        if (this.runner !== null) {
            clearTimeout(this.runner);
        }
        this.runner = setTimeout(() => {
            const result = this.processFile(doc);
            if (!result) {
                // commands.executeCommand("workbench.action.problems.focus");
            }
            this.runner = null;
        }, 1000);
    }

    /**
     * Validates the provided document immeditaely and returns the resul of the validation.
     * @param doc - Textdocument object of the current file
     */
    public validateNow(doc: TextDocument) {
        return this.processFile(doc);
    }

    /**
     * Validates the provided document using deep code analysis
     * @param doc - Textdocument object of the current file
     */
    public validateForUpload(doc: TextDocument) {
        this.diagnosticCollection.clear();

        const sourceCode = doc.getText();
        const parser = LEDBasicParserFactory.getParser();
        const result = parser.build(sourceCode);

        if (!result.success) {
            const errorResult = result as IMatchResult;
            const diagnostics = errorResult.errors?.map((error: IError) => {
                return new Diagnostic(IRange2Range(error.range), error.message, DiagnosticSeverity.Error);
            });
            this.diagnosticCollection.set(doc.uri, diagnostics);
            return false;
        }
        return true;
    }

    /**
     * Validates the code file and generates error messages for the "PROBLEMS" view
     * @param doc - Textdocument object of the current file
     */
    private processFile(doc: TextDocument): boolean {
        this.diagnosticCollection.clear();

        const sourceCode = doc.getText();
        const parser = LEDBasicParserFactory.getParser();
        let matchResult = parser.match(sourceCode);

        if (!matchResult.success && matchResult.errors) {
            const diagnostics = matchResult.errors.map((error: IError) => {
                return new Diagnostic(IRange2Range(error.range), error.message, DiagnosticSeverity.Error);
            });
            this.diagnosticCollection.set(doc.uri, diagnostics);
            return false;
        } else {
            try {
                matchResult = parser.match(sourceCode);
            } catch (e) {
                // tslint:disable-next-line: no-console
                console.log(e);
            }

            const diagnostics: Diagnostic[] = [];

            if (!matchResult.success && matchResult.errors) {
                diagnostics.concat(matchResult.errors.map((error: IError) => {
                    return new Diagnostic(IRange2Range(error.range), error.message, DiagnosticSeverity.Error);
                }));
            }

            // check for illegal API usage
            const currentDevice = deviceSelector.selectedDevice();
            let line;
            let m;
            const reg = new RegExp('((?:IO|LED|MATRIX)\\.([a-zA-Z]+))', 'gim');
            for (let index = 0; index < doc.lineCount; index++) {
                line = doc.lineAt(index);
                // skip line if empty or is a comment
                if (line.isEmptyOrWhitespace || line.text.trim().startsWith('\'')) {
                    continue;
                }

                // tslint:disable-next-line: no-conditional-assignment
                while (m = reg.exec(line.text)) {
                    let funcName = m[2];
                    const config = workspace.getConfiguration('led_basic');
                    if (config.caseInsensitiveCalls) {
                        funcName = funcName.toLowerCase();
                    }
                    // let args = m[3];
                    const cmd = currentDevice.commands.find((command) => command.name === funcName);
                    if (!cmd) {
                        const start = new Position(index, m.index);
                        const end = new Position(index, m.index + m[1].length);
                        const diagnostic = new Diagnostic(new Range(start, end), 'Command "' + m[1] + '" is not supported by current device', DiagnosticSeverity.Error);
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

                        // detect if arguments contain a read call
                        const readCalls = args.split('read ').length - 1;
                        let ac = args ? args.split(',').length : 0;
                        ac = ac - readCalls;
                        if (ac !== cmd.argcount) {
                            const start = new Position(index, m.index);
                            const end = new Position(index, m.index + m[1].length);
                            const diagnostic = new Diagnostic(new Range(start, end), 'Command "' + m[1] + '" has wrong number of arguments', DiagnosticSeverity.Error);
                            diagnostics.push(diagnostic);
                        }
                    }
                }
            }

            if (diagnostics.length) {
                this.diagnosticCollection.set(doc.uri, diagnostics);
                return false;
            }

            return true;
        }
    }
}
