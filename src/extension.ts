'use strict';

import * as vscode from 'vscode';

import { LEDBasicHoverProvider } from './LedBasicHoverProvider';
import { LEDBasicCompletionItemProvider } from './LEDBasicCompletionItemProvider';
import { LEDBasicSignatureHelpProvider } from './LEDBasicSignatureHelpProvider';
import { LEDBasicCodeValidator } from './LEDBasicCodeValidator';
import { LEDBasicDefinitionProvider } from './LEDBasicDefinitionProvider';
import { LEDBasicReferenceProvider } from './LEDBasicReferenceProvider';
import { DeviceSelector } from './DeviceSelector';

const LED_BASIC: vscode.DocumentFilter = { language: 'led_basic', scheme: 'file' };

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(ctx: vscode.ExtensionContext) {
    const completionProvider = new LEDBasicCompletionItemProvider();
    const deviceSelector = new DeviceSelector();
    diagnosticCollection = vscode.languages.createDiagnosticCollection('led_basic');
    const codeValidator = new LEDBasicCodeValidator(diagnosticCollection);

    completionProvider.setSupportedCommands(deviceSelector.selectedDevice().commands)
    codeValidator.setSupportedCommands(deviceSelector.selectedDevice().commands);

    const deviceSlectCmd = vscode.commands.registerCommand('extension.device', () => {
        deviceSelector.showSelection().then(device => {
            completionProvider.setSupportedCommands(device.commands);
            codeValidator.setSupportedCommands(device.commands);
            if (vscode.window.activeTextEditor) {
                codeValidator.validate(vscode.window.activeTextEditor.document);
            }    
        });
    });

    ctx.subscriptions.push(
        vscode.languages.registerHoverProvider(
            LED_BASIC, new LEDBasicHoverProvider()));

    ctx.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            LED_BASIC, completionProvider, '.'));

    ctx.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            LED_BASIC, new LEDBasicSignatureHelpProvider(), '(', ','));

    ctx.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            LED_BASIC, new LEDBasicDefinitionProvider()));

    ctx.subscriptions.push(
        vscode.languages.registerReferenceProvider(
            LED_BASIC, new LEDBasicReferenceProvider()));

    ctx.subscriptions.push(diagnosticCollection);
    ctx.subscriptions.push(codeValidator);
    ctx.subscriptions.push(deviceSelector);
    ctx.subscriptions.push(deviceSlectCmd);

    vscode.workspace.onDidChangeTextDocument(e => {
        codeValidator.validate(e.document);
    }, null, ctx.subscriptions);
    vscode.workspace.onDidOpenTextDocument(doc => {
        codeValidator.validate(doc);
    }, null, ctx.subscriptions)
}