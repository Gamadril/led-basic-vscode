# LED Basic extension changelog

## 2.0.2 - 27.07.2020
- fixed code validation before upload
- fixed missing serial debug device output

## 2.0.1 - 15.06.2020
- fixed a bug with mixed up labels detection
- rebuild serial port library

## 2.0.0 - 28.12.2019
- updated support to LED Basic v15.2.7
- extended LED BASIC by dropping restriction for label and variable names. Labels can be strings and variable names are not restricted to one letter
- code refactoring
- removed support for WinUSB driver
- rebuild serial port library, dropped 32bit support 
- fixed an issue in tokenizer for multiple data statements behind a label

## 1.3.0 - 06.03.2019
- Default setting value for opening terminal after upload set to false
- Reduced once again terminal implementation to simple output. Still waiting for TerminalRenderer API.
- Added alternative libUSB based serial port implementation for Windows platform
- Added configuration property "caseInsensitiveCalls" to skip case sensitive lib calls check and not show them in the problems view
- If the uploaded code leads to an error on the device, some BLP devices send the error code back to the host. If such an error is detected it is shown in the problem view pointing to the corresponding code line.
- Fixed an error in the check for the correct number of arguments in function calls. A data read call is now detected as one argument.
- Added hover support for goto/gosub calls showing the comment of the target label if available
- Showing error line if provided by device after file upload

## 1.2.4 - 26.02.2019
- corrected list of allowed commands for PICO module
- fixed wrong config value for PICO module which made it freeze after code upload

## 1.2.3 - 26.02.2019
- corrected sys code for PICO module

## 1.2.2 - 08.02.2019
- Rebuild of the serial port library was required for VSCode 1.31.0
- Icon added

## 1.2.1 - 18.12.2018
- updated device support to LED Basic v15.2.2

## 1.2.0 - 23.11.2018
- updated list of components and commands to match LED Basic v15.2.1

## 1.1.6 - 12.11.2018
- Removed Terminal implementation and replaced with simple output to debug view. Waiting for TerminalRenderer to become official API

## 1.1.4 - 16.08.2018
- Rebuild of the serial port library was required for macOS Mojave

## 1.1.3 - 14.08.2018
- Rebuild of the serial port library was required for VSCode 1.26.0

## 1.1.2 - 25.07.2018
- Added LED-Tube-Clock device
- Bugfix for the Outline View preventing detection of labels in comment lines

## 1.1.1 - 10.07.2018
- LED Basic v15.1.15 (however only available devices supported)
- Added Outline View support showing labels with corresponding comment line above the label (if present)
- Added basic terminal support for debug output (separate Terminal instance)
- Updated API documentation
- Fixed SB-Prog support
- Updated included serialport library based on current state of node-serialport
- Fixed issue #1

## 1.1.0 - 15.05.2018
- Added `if` and `ifelse` snippets for correpsonding `If Then` and `If Then Else` statements
- Added code uploader. Statusbar contains buttons for selecting a serial port and "Upload" for writing code to connected device
- Shortcut for code upload is `ctrl+alt+u` for windows/linux and `cmd+alt+u` for mac
- Improved definition and reference detection
- Improved code validator checking now function calls for the number of arguments
- Added code formatter
- Fixed several other bugs

## 1.0.1 - 22.04.2018
- Added device selection in the status bar
- Improved code completion suggesting only functions supported by selected device
- Improved code validation. Function calls not supported by currently selected device will be reported in the problems view
- Bugfix: added missing `phex` and `pdez` commands

## 1.0.0 - 20.04.2018
- Initial release
- LED Basic V15.1.14 support
- Basic Syntax highlighting
- Two code snippets `for` and `ford` for generating a `for-to-next` and `for-downto-next` blocks
- Smart Bracket support for function calls
- Shows information about symbol that's below the mouse cursor
- Code completion support
- Intial diagnostics support based on code validation using language grammar parser
- Shows details about function signatures
- Shows definition of labels allowing direct jumps to label definition by clicking on the label number in goto/gosub statement
- Shows all references to a label in the code
