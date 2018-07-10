#ifndef SRC_WIN_USB_H_
#define SRC_WIN_USB_H_

#include "serialport_win.h"
#include <Setupapi.h>

#define GPTR (GMEM_FIXED | GMEM_ZEROINIT)

BOOL updateInfo(ListResultItem *item, SP_DEVINFO_DATA *deviceInfoData,
                HDEVINFO hDevInfo);

#endif // SRC_WIN_USB_H_