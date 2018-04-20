'use strict';

import { HoverProvider, TextDocument, CancellationToken, Hover, ProviderResult, Position, MarkdownString } from 'vscode';
import { findLibSignature } from './utils';

export class LEDBasicHoverProvider implements HoverProvider {
    public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        let wordRange = document.getWordRangeAtPosition(position)
            || document.getWordRangeAtPosition(position, new RegExp('###')); // check for configuration line
        if (!wordRange) {
            return null;
        }

        let name = document.getText(wordRange);
        let entry = findLibSignature(name);

        if (entry) {
            let contents = new MarkdownString();
            contents.appendCodeblock(entry.signature, 'led_basic');
            contents.appendMarkdown(entry.description);

            return new Hover(contents, wordRange);
        }

        return null;
    }
}