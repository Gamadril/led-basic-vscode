'use strict';

import * as vscode from 'vscode';

import { decodeErrorMessage, parseResultToArray } from './Common';
import { Device } from './Device';
import { deviceSelector } from './DeviceSelector';
import { LEDBasicCodeValidator } from './LEDBasicCodeValidator';
import { LEDBasicCompletionItemProvider } from './LEDBasicCompletionItemProvider';
import { LEDBasicDefinitionProvider } from './LEDBasicDefinitionProvider';
import { LEDBasicDocumentFormatter } from './LEDBasicDocumentFormatter';
import { LEDBasicDocumentSymbolProvider } from './LEDBasicDocumentSymbolProvider';
import { LEDBasicHoverProvider } from './LEDBasicHoverProvider';
import { LEDBasicParserFactory } from './LEDBasicParserFactory';
import { LEDBasicReferenceProvider } from './LEDBasicReferenceProvider';
import { LEDBasicSignatureHelpProvider } from './LEDBasicSignatureHelpProvider';
import { output } from './OutputChannel';
import { portSelector } from './PortSelector';
import { SerialPort } from './SerialPort';
import { TERM_STATE, terminal } from './Terminal';
import { Uploader } from './Uploader';

// const LED_BASIC: vscode.DocumentFilter = { language: 'led_basic', scheme: 'file' };
const LED_BASIC = 'led_basic'; // allow all documents, from disk and unsaved. extension code does not rely on file existence

let diagnosticCollection: vscode.DiagnosticCollection;

let isUploading = false;

export function activate(ctx: vscode.ExtensionContext) {
    const completionProvider = new LEDBasicCompletionItemProvider();
    diagnosticCollection = vscode.languages.createDiagnosticCollection('led_basic');
    const codeValidator = new LEDBasicCodeValidator(diagnosticCollection);

    // detect existing serial ports and preselect if only one exists
    portSelector.init()
        .then((port) => {
            if (port) {
                const device = deviceSelector.setDevice(port.sysCode);
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

    // device selection handler
    const deviceSelectCmd = vscode.commands.registerCommand('led_basic.device', () => {
        terminal.stop();
        deviceSelector.showSelection()
            .then((device: Device) => {
                if (device.meta.noPrint) {
                    terminal.disable();
                } else {
                    terminal.enable();
                }
                return portSelector.getPortList();
            })
            .then((ports) => {
                const selectedDevice = deviceSelector.selectedDevice();
                if (ports.length) {
                    let portMatched;
                    if (selectedDevice.meta.needsSbProg) {
                        portMatched = ports.find((port) => {
                            return port.sysCode === 0x4470;
                        });
                    } else {
                        portMatched = ports.find((port) => {
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

    // port selection handler
    const portSelectCmd = vscode.commands.registerCommand('led_basic.serialports', () => {
        terminal.stop();
        portSelector.showSelection()
            .then((port) => {
                if (port) {
                    const device = deviceSelector.setDevice(port.sysCode);
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

    // terminal button handler
    const terminalCmd = vscode.commands.registerCommand('led_basic.terminal', () => {
        if (terminal.state === TERM_STATE.CONNECTED) {
            terminal.stop();
        } else if (terminal.state === TERM_STATE.DISCONNECTED) {
            terminal.start().catch((error) => {
                output.logError(error);
            });
        }
    });

    // upload code handler
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBarItem.command = 'led_basic.upload';
    statusBarItem.text = '$(triangle-right) Upload';
    statusBarItem.show();

    const uploadCmd = vscode.commands.registerCommand('led_basic.upload', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'led_basic') {
            return;
        }
        const doc = editor.document;

        LEDBasicParserFactory.getParser().build(doc.getText());

        output.clear();

        if (isUploading) {
            output.logInfo('Upload already in progress');
            return;
        }

        const targetDevice = deviceSelector.selectedDevice();
        const selectedPort = portSelector.selectedPort();

        if (!selectedPort) {
            output.logError('Serial port not selected.');
            return;
        }

        if (!targetDevice) {
            output.logError('Target device not selected.');
            return;
        }

        // check if selected target device does match the connected device. In the case of SB-Prog this check is done during upload
        if (selectedPort.sysCode !== 0x4470 && targetDevice.meta.sysCode !== selectedPort.sysCode) {
            output.logError('Selected device does not match the connected device.');
            output.logInfo('Target device: ' + targetDevice.label);
            output.logInfo('Connected device: ' + selectedPort.deviceName);
            return;
        }

        isUploading = true;

        // async chain since VSC output channel logs seem to be blocking operations. Output appears only at the end of upload as whole text block.
        terminal.stop()
            .then(() => output.logInfo('Starting code validation...'))
            .then(() => {
                if (!codeValidator.validateNow(doc)) {
                    vscode.commands.executeCommand('workbench.action.problems.focus');
                    throw new Error('Errors in code detected');
                }
                return output.logInfo('Code is valid');
            })
            .then(() => output.logInfo('Starting code tokenizer...'))
            .then(() => {
                const result = LEDBasicParserFactory.getParser().build(doc.getText());
                if (!result) {
                    vscode.commands.executeCommand('workbench.action.problems.focus');
                    throw new Error('Invalid code detected');
                }
                return result;
            })
            .then((result) => {
                output.logInfo('Starting code upload...');
                if (!selectedPort) {
                    throw new Error('Serial port not selected');
                }
                const uploader = new Uploader(selectedPort, targetDevice, {
                    createSerialPort: (name, options) => {
                        return new SerialPort(name, options);
                    }
                });
                const file = parseResultToArray(result, targetDevice.meta);
                return uploader.upload(file);
            })
            .then((error) => {
                isUploading = false;
                output.logInfo('Upload done');
                if (error) {
                    const deviceError = decodeErrorMessage(error);
                    if (deviceError) {
                        output.logError('Device message: ' + deviceError.msg);
                        const start = new vscode.Position(deviceError.line - 1, 0);
                        const end = start;
                        const diagnostic = new vscode.Diagnostic(new vscode.Range(start, end), deviceError.msg, vscode.DiagnosticSeverity.Error);
                        diagnosticCollection.set(doc.uri, [diagnostic]);
                    }
                }
                const config = vscode.workspace.getConfiguration('led_basic');
                if (config && config.openTerminalAfterUpload) {
                    terminal.start();
                }
            })
            .catch((err) => {
                isUploading = false;
                output.logError(err.message);
            });
    });

    ctx.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            LED_BASIC, new LEDBasicDocumentFormatter()));

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

    const dsp = new LEDBasicDocumentSymbolProvider();
    ctx.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            LED_BASIC, dsp));

    ctx.subscriptions.push(
        vscode.languages.registerHoverProvider(
            LED_BASIC, new LEDBasicHoverProvider(dsp)));

    ctx.subscriptions.push(diagnosticCollection);
    ctx.subscriptions.push(codeValidator);
    ctx.subscriptions.push(deviceSelector);
    ctx.subscriptions.push(deviceSelectCmd);
    ctx.subscriptions.push(portSelector);
    ctx.subscriptions.push(portSelectCmd);
    ctx.subscriptions.push(uploadCmd);
    ctx.subscriptions.push(terminal);
    ctx.subscriptions.push(terminalCmd);
    ctx.subscriptions.push(statusBarItem);

    vscode.workspace.onDidChangeTextDocument((e) => {
        codeValidator.validate(e.document);
    }, null, ctx.subscriptions);

    vscode.workspace.onDidOpenTextDocument((doc) => {
        codeValidator.validate(doc);
    }, null, ctx.subscriptions);
}
