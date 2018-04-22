'use strict';

import { DiagnosticCollection, Diagnostic, DiagnosticSeverity, Range, TextDocument } from "vscode";
import { LEDBasicParser, IError } from "./LEDBasicParser";

export class LEDBasicCodeValidator {
    private _parser: LEDBasicParser | null = null;
    private _runner: NodeJS.Timer | null = null;
    private _diagnosticCollection: DiagnosticCollection | null;
    private _deviceCommands: string[] = [];

    constructor(diagnosticCollection: DiagnosticCollection) {
        this._diagnosticCollection = diagnosticCollection;
        this._parser = new LEDBasicParser();
    }

    dispose() {
        this._diagnosticCollection = null;
        this._parser = null;
        if (this._runner !== null) {
            clearTimeout(this._runner);
            this._runner = null;
        }
    }

    public setSupportedCommands(commands: string[]) {
        this._deviceCommands = commands;
    }

    public validate(doc: TextDocument) {
        return this.parseFile(doc);
    }

    private parseFile(doc: TextDocument) {
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
            this.processFile(doc);
            this._runner = null;
        }, 400);
    }

    private processFile(doc: TextDocument) {
        if (!this._parser || !this._diagnosticCollection) {
            return;
        }
        this._diagnosticCollection.clear();

        let sourceCode = doc.getText();
        let matchResult = this._parser.match(sourceCode);

        if (!matchResult.success && matchResult.errors) {
            let diagnostics = matchResult.errors.map((error: IError) => {
                return new Diagnostic(error.range, error.message, DiagnosticSeverity.Error)
            });
            this._diagnosticCollection.set(doc.uri, diagnostics);
        } else {
            try {
                matchResult = this._parser.build(sourceCode);
            } catch (e) {
                console.log(e);
            }
            
            let diagnostics: Diagnostic[] = [];

            if (!matchResult.success && matchResult.errors) {
                diagnostics.concat(matchResult.errors.map((error: IError) => {
                    return new Diagnostic(error.range, error.message, DiagnosticSeverity.Error)
                }));
            }

            // check for illegal API usage
            let reg = new RegExp('(?:IO|LED)\\.([a-zA-Z]*)', 'gi');
            let m;
            while (m = reg.exec(sourceCode)) {
                let funcName = m[1];
                if (this._deviceCommands.indexOf(funcName) === -1) {
                    let start = doc.positionAt(m.index);
                    let end = doc.positionAt(m.index + m[0].length);
                    let diagnostic = new Diagnostic(new Range(start, end), 'Command ' + m[0] + ' is not supported by current device', DiagnosticSeverity.Error);
                    diagnostics.push(diagnostic);
                }
            }

            if (diagnostics.length) {
                this._diagnosticCollection.set(doc.uri, diagnostics);
            }
        }
    }
}