import { DiagnosticCollection, TextDocumentChangeEvent, Diagnostic, DiagnosticSeverity, Range, Position } from "vscode";

'use strict';

import ohm = require('ohm-js')
import fs = require('fs');
import { getExtensionPath } from "./utils";

export class LEDBasicCodeValidator {
    grammar: ohm.Grammar | null = null;
    runner: NodeJS.Timer | null = null;
    diagnosticCollection: DiagnosticCollection;

    constructor(diagnosticCollection: DiagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;

        let rootDir = getExtensionPath();
        let contents = fs.readFileSync(rootDir + 'res/grammar.ohm');
        this.grammar = ohm.grammar(contents.toString());
    }

    public getListener() {
        return this.parseFile.bind(this);
    }

    private parseFile(e: TextDocumentChangeEvent) {
        if (e.document.isUntitled) {
            return;
        }
        if (e.document.languageId !== 'led_basic') {
            return;
        }
        if (this.runner != null) {
            clearTimeout(this.runner);
        }
        this.runner = setTimeout(() => {
            this.processFile(e);
            this.runner = null;
        }, 500);
    }

    private processFile(e: TextDocumentChangeEvent) {
        this.diagnosticCollection.clear();

        if (!this.grammar) {
            return;
        }

        var m = this.grammar.match(e.document.getText());
        if (!m.succeeded()) {
            //console.log(m.message);
            //console.log(m.shortMessage);
            if (m.shortMessage) {
                let parts = /Line (\d+), col (\d+): (.*)/g.exec(m.shortMessage);
                if (parts) {
                    let pos = new Position(parseInt(parts[1]) - 1, parseInt(parts[2]));
                    let range = new Range(pos, pos);
                    let diagnostic = new Diagnostic(range, parts[3], DiagnosticSeverity.Error);
                    let diagnostics = [diagnostic];
                    this.diagnosticCollection.set(e.document.uri, diagnostics);
                }
            }
        }
    }
}