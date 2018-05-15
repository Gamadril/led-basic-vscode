# VS Code LED Basic language support

This extension adds LED Basic support for Visual Studio Code.

![](gh/auto_complete.gif)

![](gh/upload.gif)

## Features
- LED Basic V15.1.14 support
- Basic Syntax highlighting
- Code snippets: `for/ford`, `if/ifelse`
- Smart Bracket support
- Hover symbol information
- Code completion support
- Code fromatter included
- Initial diagnostics support based on code validation using language grammar parser
- Jump to label from goto/gosub or read commands
- Shows all references to a label
- Code upload to device

## Serial port - Linux
If you get an error on code upload saying that you don't have permissions to access the serial port, add your user to the dialout group:
`sudo gpasswd --add ${USER} dialout`
Logout and login back.

## Issues
Please report problems and feature requests on [github](https://github.com/Gamadril/led-basic-vscode/issues)

## Licence
MIT license, see [LICENSE](./LICENSE)


