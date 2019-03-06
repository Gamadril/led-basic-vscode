'use strict';

import { HoverProvider, TextDocument, CancellationToken, Hover, ProviderResult, Position, MarkdownString } from 'vscode';
import { findLibSignature } from './utils';
import { LEDBasicDocumentSymbolProvider } from './LEDBasicDocumentSymbolProvider';

export class LEDBasicHoverProvider implements HoverProvider {
    _dsp: LEDBasicDocumentSymbolProvider;

    constructor(docSymbolProvider: LEDBasicDocumentSymbolProvider) {
        this._dsp = docSymbolProvider;
    }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        let wordRange = document.getWordRangeAtPosition(position)
            || document.getWordRangeAtPosition(position, new RegExp('###')); // check for configuration line
        if (!wordRange) {
            return null;
        }

        let name = document.getText(wordRange);
        let entry = findLibSignature(name);

        // look for lib signatures and led basic keywords first
        if (entry) {
            let contents = new MarkdownString();
            contents.appendCodeblock(entry.signature, 'led_basic');
            contents.appendMarkdown(entry.description);

            return new Hover(contents, wordRange);
        } else { // look for labels
            let line = document.lineAt(wordRange.start.line);
            if (!line.text.match(new RegExp('(?:goto|gosub)\\s+(' + name + ')'))) {
                return null;
            }
            let symbols = this._dsp.provideDocumentSymbols(document, token);
            if (symbols instanceof Array) {
                let labelSymbol = symbols.find(symbol => {
                    return symbol.name.startsWith(name + ':');
                });

                if (labelSymbol && labelSymbol.detail) {
                    let contents = new MarkdownString();
                    contents.appendCodeblock('\'' + labelSymbol.detail, 'led_basic');

                    return new Hover(contents, wordRange);
                }
            }
        }

        return null;
    }
}