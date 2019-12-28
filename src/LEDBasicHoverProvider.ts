'use strict';

import { CancellationToken, Hover, HoverProvider, MarkdownString, Position, ProviderResult, TextDocument } from 'vscode';
import { LEDBasicDocumentSymbolProvider } from './LEDBasicDocumentSymbolProvider';
import { findLibSignature } from './utils';

export class LEDBasicHoverProvider implements HoverProvider {
    private dsp: LEDBasicDocumentSymbolProvider;

    constructor(docSymbolProvider: LEDBasicDocumentSymbolProvider) {
        this.dsp = docSymbolProvider;
    }

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        const wordRange = document.getWordRangeAtPosition(position)
            || document.getWordRangeAtPosition(position, new RegExp('###')); // check for configuration line
        if (!wordRange) {
            return null;
        }

        const name = document.getText(wordRange);
        const entry = findLibSignature(name);

        // look for lib signatures and led basic keywords first
        if (entry) {
            const contents = new MarkdownString();
            contents.appendCodeblock(entry.signature, 'led_basic');
            contents.appendMarkdown(entry.description);

            return new Hover(contents, wordRange);
        } else { // look for labels
            const line = document.lineAt(wordRange.start.line);
            if (!line.text.match(new RegExp('(?:goto|gosub)\\s+(' + name + ')'))) {
                return null;
            }
            const symbols = this.dsp.provideDocumentSymbols(document, token);
            if (symbols instanceof Array) {
                const labelSymbol = symbols.find((symbol) => {
                    return symbol.name.startsWith(name + ':');
                });

                if (labelSymbol && labelSymbol.detail) {
                    const contents = new MarkdownString();
                    contents.appendCodeblock('\'' + labelSymbol.detail, 'led_basic');

                    return new Hover(contents, wordRange);
                }
            }
        }

        return null;
    }
}
