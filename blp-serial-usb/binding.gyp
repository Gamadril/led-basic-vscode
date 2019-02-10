{
    "targets": [{
        "target_name": "blp-serial-usb",
        "sources": [
            "src/read_worker.cpp",
            "src/write_worker.cpp",
            "src/serialport.cpp"
        ],
        "include_dirs": [
            "<!(node -e \"require('nan')\")"
        ],
        "dependencies": [
            "libusb.gypi:libusb",
        ],
        "conditions": [
            [
                "OS=='mac'",
                {
                    "libraries": [
                        "-framework CoreFoundation -framework IOKit"
                    ]
                }
            ],
            [
                "OS=='win'",
                {
                    "defines": [
                        "WIN32_LEAN_AND_MEAN"
                    ],
                    "configurations": {
                        "Release": {
                            "defines": ["NDEBUG"]
                        }
                    }
                }
            ]
        ]
    }]
}
