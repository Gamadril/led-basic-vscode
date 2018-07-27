'use strict';

import * as vscode from 'vscode';

import { LEDBasicHoverProvider } from './LEDBasicHoverProvider';
import { LEDBasicCompletionItemProvider } from './LEDBasicCompletionItemProvider';
import { LEDBasicSignatureHelpProvider } from './LEDBasicSignatureHelpProvider';
import { LEDBasicCodeValidator } from './LEDBasicCodeValidator';
import { LEDBasicDefinitionProvider } from './LEDBasicDefinitionProvider';
import { LEDBasicReferenceProvider } from './LEDBasicReferenceProvider';
import { portSelector } from './PortSelector';
import { uploader } from './Uploader';
import { deviceSelector } from './DeviceSelector';
import { ledBasicParser } from './LEDBasicParser';
import { output } from './OutputChannel';
import { LEDBasicDocumentFormatter } from './LEDBasicDocumentFormatter';
import { terminal, TERM_STATE } from './Terminal';
import { LEDBasicDocumentSymbolProvider } from './LEDBasicDocumentSymbolProvider';

//const LED_BASIC: vscode.DocumentFilter = { language: 'led_basic', scheme: 'file' };
const LED_BASIC = 'led_basic'; // allow all documents, from disk and unsaved. extension code does not rely on file existence 

let diagnosticCollection: vscode.DiagnosticCollection;

var isUploading = false;

export function activate(ctx: vscode.ExtensionContext) {
    const completionProvider = new LEDBasicCompletionItemProvider();
    diagnosticCollection = vscode.languages.createDiagnosticCollection('led_basic');
    const codeValidator = new LEDBasicCodeValidator(diagnosticCollection);

    // detect existing serial ports and preselect if only one exists
    portSelector.init()
        .then((port) => {
            if (port) {
                let device = deviceSelector.setDevice(port.sysCode);
                if (device.meta.noPrint) {
                    terminal.disable();
                } else {
                    terminal.enable();
                }
                if (vscode.window.activeTextEditor) {
                    codeValidator.validate(vscode.window.activeTextEditor.document);
                }
            } else {
                terminal.disable();
            }
        });

    const deviceSelectCmd = vscode.commands.registerCommand('led_basic.device', () => {
        terminal.stop();
        deviceSelector.showSelection()
            .then(device => {
                if (device.meta.noPrint) {
                    terminal.disable();
                } else {
                    terminal.enable();
                }
                return portSelector.getPortList();
            })
            .then(ports => {
                var selectedDevice = deviceSelector.selectedDevice();
                if (ports.length) {
                    let portMatched;
                    if (selectedDevice.meta.needsSbProg) {
                        portMatched = ports.find(port => {
                            return port.sysCode === 0x4470;
                        });
                    } else {
                        portMatched = ports.find(port => {
                            return port.sysCode === selectedDevice.meta.sysCode;
                        });
                    }

                    portSelector.setPort(portMatched || null);
                }
                if (vscode.window.activeTextEditor) {
                    codeValidator.validate(vscode.window.activeTextEditor.document);
                }
            });
    });

    const portSelectCmd = vscode.commands.registerCommand('led_basic.serialports', () => {
        terminal.stop();
        portSelector.showSelection()
            .then(port => {
                if (port) {
                    let device = deviceSelector.setDevice(port.sysCode);
                    if (device.meta.noPrint) {
                        terminal.disable();
                    } else {
                        terminal.enable();
                    }
                    if (vscode.window.activeTextEditor) {
                        codeValidator.validate(vscode.window.activeTextEditor.document);
                    }
                }
            });
    });

    const terminalCmd = vscode.commands.registerCommand('led_basic.terminal', () => {
        if (terminal.state === TERM_STATE.CONNECTED) {
            terminal.stop();
        } else if (terminal.state === TERM_STATE.DISCONNECTED) {
            terminal.start();
        }
    });

    const uploadCmd = vscode.commands.registerCommand('led_basic.upload', () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "led_basic") {
            return;
        }
        let doc = editor.document;

        output.clear();

        if (isUploading) {
            output.logInfo('Uplad already in progress');
            return;
        }

        let targetDevice = deviceSelector.selectedDevice();
        let selectedPort = portSelector.selectedPort();

        if (!selectedPort) {
            output.logError('Serial port not selected.');
            return;
        }

        if (!targetDevice) {
            output.logError('Target device not selected.');
            return;
        }

        if (selectedPort.sysCode !== 0x4470 && targetDevice.meta.sysCode !== selectedPort.sysCode) {
            output.logError('Selected device does not match the connected device.');
            output.logInfo('Target device: ' + targetDevice.label);
            output.logInfo('Connected device: ' + selectedPort.deviceName);
            return;
        }

        isUploading = true;

        // async chain since VSC output channel logs seem to be blocking operations. Output appears only at the end of upload as whole text block.
        terminal.stop()
            .then(() => {
                return output.logInfo('Starting code validation...');
            })
            .then(() => {
                if (!codeValidator.validateNow(doc)) {
                    vscode.commands.executeCommand("workbench.action.problems.focus");
                    //vscode.window.showWarningMessage('There are syntax errors in your code.');
                    throw new Error('Errors in code detected');
                }
                return output.logInfo('Code is valid');
            })
            .then(() => {
                return output.logInfo('Starting code tokenizer...');
            })
            .then(() => {
                let result = ledBasicParser.build(doc.getText());
                if (!result) {
                    vscode.commands.executeCommand("workbench.action.problems.focus");
                    //vscode.window.showWarningMessage('There are syntax errors in your code.');
                    throw new Error('Invalid code detected');
                }

                output.logInfo('Code tokenized');
                return result;
            })
            .then((result) => {
                output.logInfo('Starting code upload...');
                return uploader.upload(result);
            })
            .then(() => {
                isUploading = false;
                output.logInfo('Upload done');
                let config = vscode.workspace.getConfiguration('led_basic');
                if (config && config.openTerminalAfterUpload) {
                    terminal.start();
                }
            })
            .catch((err) => {
                output.logError(err.message);
                isUploading = false;
            });
    });

    ctx.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            LED_BASIC, new LEDBasicDocumentFormatter()));

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

    ctx.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            LED_BASIC, new LEDBasicDocumentSymbolProvider()));

    ctx.subscriptions.push(diagnosticCollection);
    ctx.subscriptions.push(codeValidator);
    ctx.subscriptions.push(deviceSelector);
    ctx.subscriptions.push(deviceSelectCmd);
    ctx.subscriptions.push(portSelector);
    ctx.subscriptions.push(portSelectCmd);
    ctx.subscriptions.push(uploader);
    ctx.subscriptions.push(uploadCmd);
    ctx.subscriptions.push(terminal);
    ctx.subscriptions.push(terminalCmd);

    vscode.workspace.onDidChangeTextDocument(e => {
        codeValidator.validate(e.document);
    }, null, ctx.subscriptions);

    vscode.workspace.onDidOpenTextDocument(doc => {
        codeValidator.validate(doc);
    }, null, ctx.subscriptions);
}