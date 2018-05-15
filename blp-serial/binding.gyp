{
    "targets": [
        {
            "target_name": "blp-serial",
            "sources": [
                "src/serialport.cpp"
            ],
            "include_dirs": [
                "<!(node -e \"require('nan')\")"
            ],
            "conditions": [
                [
                    "OS=='win'",
                    {
                        "sources": [
                            "src/win_usb.cpp",
                            "src/serialport_win.cpp"
                        ],
                        "msvs_settings": {
                            "VCCLCompilerTool": {
                                "ExceptionHandling": "2",
                                "DisableSpecificWarnings": [
                                    "4530",
                                    "4506"
                                ]
                            }
                        },
                        "include_dirs+": []
                    }
                ],
                [
                    "OS=='mac'",
                    {
                        "sources": [
                            "src/serialport_unix.cpp",
                            "src/serialport_poller.cpp"
                        ],
                        "libraries": [
                            "-framework CoreFoundation -framework IOKit"
                        ]
                    }
                ],
                [
                    "OS=='linux'",
                    {
                        "sources": [
                            "src/serialport_linux.cpp",
                            "src/serialport_unix.cpp",
                            "src/serialport_poller.cpp"
                        ]
                    }
                ]
            ]
        }
    ]
}
