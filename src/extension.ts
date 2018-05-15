'use strict';

import * as vscode from 'vscode';

import { LEDBasicHoverProvider } from './LEDBasicHoverProvider';
import { LEDBasicCompletionItemProvider } from './LEDBasicCompletionItemProvider';
import { LEDBasicSignatureHelpProvider } from './LEDBasicSignatureHelpProvider';
import { LEDBasicCodeValidator } from './LEDBasicCodeValidator';
import { LEDBasicDefinitionProvider } from './LEDBasicDefinitionProvider';
import { LEDBasicReferenceProvider } from './LEDBasicReferenceProvider';
import { COLOR_ORDER } from './Device';
import { portSelector } from './PortSelector';
import { uploader } from './Uploader';
import { deviceSelector } from './DeviceSelector';
import { ledBasicParser, IConfig } from './LEDBasicParser';
import { output } from './OutputChannel';
import { LEDBasicDocumentFormatter } from './LEDBasicDocumentFormatter';
//import { terminal } from './Terminal';

const LED_BASIC: vscode.DocumentFilter = { language: 'led_basic', scheme: 'file' };
const LBO_HEADER_SIZE = 16;

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
                deviceSelector.setDevice(port.sysCode);
                if (vscode.window.activeTextEditor) {
                    codeValidator.validate(vscode.window.activeTextEditor.document);
                }
            }
        });

    const deviceSelectCmd = vscode.commands.registerCommand('led_basic.device', () => {
        deviceSelector.showSelection()
            .then(device => {
                return portSelector.getPortList();
            })
            .then(ports => {
                var selectedDevice = deviceSelector.selectedDevice();
                if (ports.length) {
                    var portMatched = ports.find(port => {
                        return port.sysCode === selectedDevice.meta.sysCode;
                    });

                    portSelector.setPort(portMatched || null);
                }
                if (vscode.window.activeTextEditor) {
                    codeValidator.validate(vscode.window.activeTextEditor.document);
                }
            });
    });

    const portSelectCmd = vscode.commands.registerCommand('led_basic.serialports', () => {
        portSelector.showSelection()
            .then(port => {
                if (port) {
                    deviceSelector.setDevice(port.sysCode);
                    if (vscode.window.activeTextEditor) {
                        codeValidator.validate(vscode.window.activeTextEditor.document);
                    }
                }
            });
    });

    const uploadCmd = vscode.commands.registerCommand('led_basic.upload', () => {
        if (isUploading) {
            output.logInfo('Uplad already in progress');
            return;
        }

        isUploading = true;

        output.clear();
        if (vscode.window.activeTextEditor) {
            let targetDevice = deviceSelector.selectedDevice();
            let selectedPort = portSelector.selectedPort();

            if (!selectedPort) {
                output.logError('Serial port not selected.');
                isUploading = false;
                return;
            }

            if (!targetDevice) {
                output.logError('Target device not selected.');
                isUploading = false;
                return;
            }

            output.logInfo('Target device: ' + targetDevice.label);
            output.logInfo('Connected device: ' + selectedPort.deviceName)

            if (targetDevice.meta.sysCode !== selectedPort.sysCode) {
                output.logError('Selected device does not match the connected device.');
                isUploading = false;
                return;
            }

            output.logInfo('Starting code validation...');
            if (!codeValidator.validateNow(vscode.window.activeTextEditor.document)) {
                vscode.commands.executeCommand("workbench.action.problems.focus");
                vscode.window.showWarningMessage('There are syntax errors in your code.');
                isUploading = false;
                return;
            }
            output.logInfo('Code is valid');

            output.logInfo('Starting code tokenizer...');
            let result = ledBasicParser.build(vscode.window.activeTextEditor.document.getText());
            if (result) {
                output.logInfo('Code tokenized');
                let lbo = new Uint8Array(result.code.length + LBO_HEADER_SIZE);
                let header = createLboHeader(result.config, result.code.length);

                lbo.set(header, 0);
                lbo.set(result.code, LBO_HEADER_SIZE);

                output.logInfo('Starting code upload...');
                uploader.upload(lbo)
                    .then(() => {
                        output.logInfo('Upload done');
                        isUploading = false;
                        //terminal.start(); // TODO configurable
                    })
                    .catch((err: Error) => {
                        output.logError(err.message);
                        isUploading = false;
                    });
            } else {
                output.logError('Invalid code detected.');
                vscode.commands.executeCommand("workbench.action.problems.focus");
                vscode.window.showWarningMessage('There are syntax errors in your code.');
                isUploading = false;
            }
        }
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

    ctx.subscriptions.push(diagnosticCollection);
    ctx.subscriptions.push(codeValidator);
    ctx.subscriptions.push(deviceSelector);
    ctx.subscriptions.push(deviceSelectCmd);
    ctx.subscriptions.push(portSelector);
    ctx.subscriptions.push(portSelectCmd);
    ctx.subscriptions.push(uploader);
    ctx.subscriptions.push(uploadCmd);

    vscode.workspace.onDidChangeTextDocument(e => {
        codeValidator.validate(e.document);
    }, null, ctx.subscriptions);

    vscode.workspace.onDidOpenTextDocument(doc => {
        codeValidator.validate(doc);
    }, null, ctx.subscriptions)
}

function createLboHeader(config: IConfig, codeLength: number): Uint8Array {
    var meta = deviceSelector.selectedDevice().meta;
    var header = new Uint8Array(LBO_HEADER_SIZE);
    var dv = new DataView(header.buffer);

    // set the sys code of the currently selected device
    dv.setUint16(0, meta.sysCode, true);
    // set the size of the LBO header
    dv.setUint8(2, LBO_HEADER_SIZE);
    // set the LED-Basic version
    dv.setUint8(3, meta.basver || 0x0F);
    // set the size of the code
    dv.setUint16(4, codeLength, true);
    // set the max number of LEDs. If a device has a fixed number of LEDs - use
    // this value, otherwise check the config line from the code or finally a default value
    let ledcnt: number;
    if (meta.ledcnt !== undefined) {
        ledcnt = meta.ledcnt;
    } else if (config.ledcnt !== undefined) {
        ledcnt = config.ledcnt;
    } else if (meta.default_ledcnt !== undefined) {
        ledcnt = meta.default_ledcnt;
    } else {
        ledcnt = 255;
    }
    dv.setUint16(6, ledcnt, true);
    // set the color order
    dv.setUint8(8, meta.color_order || config.color_order || COLOR_ORDER.GRB); // color order RGB / GRB
    // calculate and set cfg bits
    var cfg = 0x00;
    if (config.gprint === true || config.gprint === undefined) {
        cfg |= 0x02;
    }
    if (config.white) {
        cfg |= 0x01;
    }
    if (config.sys_led === undefined) {
        config.sys_led = 3;
    }
    if (config.sys_led) {
        cfg |= (config.sys_led << 2);
    }
    dv.setUint8(9, meta.cfg || cfg);
    // set the frame rate
    dv.setUint8(10, config.frame_rate || 25);
    // set the master brightness
    dv.setUint8(11, meta.mbr || config.mbr || 100);
    // set the led type specific to the device
    dv.setUint8(12, meta.led_type || config.led_type || 0);
    // set the SPI rate for the APA102 compatible LEDs
    dv.setUint8(13, meta.spi_rate || config.spi_rate || 4);

    return header;
}