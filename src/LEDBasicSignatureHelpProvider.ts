'use strict';

import { CancellationToken, MarkdownString, ParameterInformation, Position, ProviderResult, SignatureHelp, SignatureHelpProvider, SignatureInformation, TextDocument } from 'vscode';
import { findLibSignature, getExtensionPath } from './utils';

export class LEDBasicSignatureHelpProvider implements SignatureHelpProvider {
    public provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<SignatureHelp> {
        const theCall = this.walkBackwardsToBeginningOfCall(document, position);

        if (theCall) {
            const callerPos = this.previousTokenPosition(document, theCall.openParen);

            if (callerPos) {
                const wordRange = document.getWordRangeAtPosition(callerPos);
                const funcName = document.getText(wordRange);

                const entry = findLibSignature(funcName);

                if (entry) {
                    const sigHelp = new SignatureHelp();
                    const content = new MarkdownString();
                    content.appendMarkdown(entry.description);
                    const si = new SignatureInformation(entry.signature, content);
                    if (entry.parameters) {
                        si.parameters = entry.parameters.map((param) => {
                            // check for images, e.g. ![](res/segment.png)
                            let description = param.description;
                            const imagePath = /\[\w*\]\((.*)\)/g.exec(description);
                            if (imagePath) {
                                description = description.replace(imagePath[1], getExtensionPath() + imagePath[1]);
                            }
                            return new ParameterInformation(param.name, new MarkdownString(description));
                        });
                    }
                    sigHelp.activeSignature = 0;
                    sigHelp.activeParameter = Math.min(theCall.commas.length, si.parameters.length - 1);
                    sigHelp.signatures = [si];
                    return sigHelp;
                }
            }
        }

        return null;
    }

    private previousTokenPosition(document: TextDocument, position: Position): Position | null {
        while (position.character > 0) {
            const word = document.getWordRangeAtPosition(position);
            if (word) {
                return word.start;
            }
            position = position.translate(0, -1);
        }
        return null;
    }

    private walkBackwardsToBeginningOfCall(document: TextDocument, position: Position): { openParen: Position, commas: Position[] } | null {
        let parenBalance = 0;
        const commas = [];

        const currentLine = document.lineAt(position.line).text.substring(0, position.character);
        const characterPosition = position.character;

        for (let char = characterPosition; char >= 0; char--) {
            switch (currentLine[char]) {
                case '(':
                    parenBalance--;
                    if (parenBalance < 0) {
                        return {
                            openParen: new Position(position.line, char),
                            commas
                        };
                    }
                    break;
                case ')':
                    parenBalance++;
                    break;
                case ',':
                    if (parenBalance === 0) {
                        commas.push(new Position(position.line, char));
                    }
            }
        }
        return null;
    }
}
