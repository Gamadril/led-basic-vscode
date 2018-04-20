'use strict';

import * as vscode from 'vscode';

import { LEDBasicHoverProvider } from './LedBasicHoverProvider';
import { LEDBasicCompletionItemProvider } from './LEDBasicCompletionItemProvider';
import { LEDBasicSignatureHelpProvider } from './LEDBasicSignatureHelpProvider';
import { LEDBasicCodeValidator } from './LEDBasicCodeValidator';
import { LEDBasicDefinitionProvider } from './LEDBasicDefinitionProvider';
import { LEDBasicReferenceProvider } from './LEDBasicReferenceProvider';

const LED_BASIC: vscode.DocumentFilter = { language: 'led_basic', scheme: 'file' };

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerHoverProvider(
            LED_BASIC, new LEDBasicHoverProvider()));

    ctx.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            LED_BASIC, new LEDBasicCompletionItemProvider(), '.'));

    ctx.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            LED_BASIC, new LEDBasicSignatureHelpProvider(), '(', ','));

    ctx.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            LED_BASIC, new LEDBasicDefinitionProvider()));

    ctx.subscriptions.push(
        vscode.languages.registerReferenceProvider(
            LED_BASIC, new LEDBasicReferenceProvider()));

    diagnosticCollection = vscode.languages.createDiagnosticCollection('led_basic');
    ctx.subscriptions.push(diagnosticCollection);

    let codeValidator = new LEDBasicCodeValidator(diagnosticCollection);
    vscode.workspace.onDidChangeTextDocument(codeValidator.getListener(), null, ctx.subscriptions);
}