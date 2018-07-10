#include "win_usb.h"
#include <cfgmgr32.h>
#include <devguid.h>
#include <usbioctl.h>
#include <windows.h>

#define MAX_REGISTRY_KEY_SIZE 255

char *GetStringDescriptor(HANDLE hHubDevice, ULONG ConnectionIndex,
                          UCHAR DescriptorIndex);

PUSB_DESCRIPTOR_REQUEST
GetConfigDescriptor(HANDLE hHubDevice, ULONG ConnectionIndex,
                    UCHAR DescriptorIndex);

BOOL updateInfo(ListResultItem *item, SP_DEVINFO_DATA *deviceInfoData,
                HDEVINFO hDevInfo) {
  DWORD dwSize;
  char szBuffer[MAX_REGISTRY_KEY_SIZE];

  // get root hub
  DEVINST hubDevInst;
  CM_Get_Parent(&hubDevInst, deviceInfoData->DevInst, 0);

  // get hub's id and convert it to path
  CM_Get_Device_ID(hubDevInst, szBuffer, sizeof(szBuffer), 0);
  char *hubDeviceId = strdup(szBuffer);
  for (int i = 0; i < strlen(hubDeviceId); i++) {
    switch (hubDeviceId[i]) {
    case '\\':
      hubDeviceId[i] = '#';
      break;
    }
  }
  char hubPath[MAX_REGISTRY_KEY_SIZE];
  snprintf(hubPath, sizeof hubPath,
           "\\\\?\\%s#{f18a0e88-c30c-11d0-8815-00a0c906bed8}", hubDeviceId);
  free(hubDeviceId);

  if (!SetupDiGetDeviceRegistryProperty(
          hDevInfo, deviceInfoData, SPDRP_LOCATION_INFORMATION, NULL,
          (PBYTE)szBuffer, sizeof(szBuffer), &dwSize)) {
    return FALSE;
  }

  // get the location of the device in the hub tree
  ULONG portIndex;
  sscanf_s(szBuffer, "Port_#%04ul", &portIndex);

  BOOL success = 0;
  HANDLE hHubDevice = NULL;
  USB_NODE_CONNECTION_INFORMATION_EX connectionInfo;
  DWORD size = sizeof connectionInfo;

  hHubDevice = CreateFile(hubPath, GENERIC_WRITE, FILE_SHARE_WRITE, NULL,
                          OPEN_EXISTING, 0, NULL);

  // get information, interesting part is the device descriptor
  connectionInfo.ConnectionIndex = portIndex;
  success = DeviceIoControl(
      hHubDevice, IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX, &connectionInfo,
      size, &connectionInfo, size, &size, NULL);

  item->productId = connectionInfo.DeviceDescriptor.idProduct;
  item->vendorId = connectionInfo.DeviceDescriptor.idVendor;
  item->bcdDevice = connectionInfo.DeviceDescriptor.bcdDevice;

  item->manufacturer = GetStringDescriptor(hHubDevice, portIndex, 1);
  item->deviceName = GetStringDescriptor(hHubDevice, portIndex, 2);
  item->serialNumber = GetStringDescriptor(hHubDevice, portIndex, 3);

  return TRUE;
}

char *GetStringDescriptor(HANDLE hHubDevice, ULONG ConnectionIndex,
                          UCHAR DescriptorIndex) {
  BOOL success = 0;
  ULONG nBytes = 0;
  ULONG nBytesReturned = 0;

  UCHAR stringDescReqBuf[sizeof(USB_DESCRIPTOR_REQUEST) +
                         MAXIMUM_USB_STRING_LENGTH];

  PUSB_DESCRIPTOR_REQUEST stringDescReq = NULL;
  PUSB_STRING_DESCRIPTOR stringDesc = NULL;

  nBytes = sizeof(stringDescReqBuf);

  stringDescReq = (PUSB_DESCRIPTOR_REQUEST)stringDescReqBuf;
  stringDesc = (PUSB_STRING_DESCRIPTOR)(stringDescReq + 1);

  // Zero fill the entire request structure
  //
  memset(stringDescReq, 0, nBytes);

  // Indicate the port from which the descriptor will be requested
  stringDescReq->ConnectionIndex = ConnectionIndex;

  //
  // USBHUB uses URB_FUNCTION_GET_DESCRIPTOR_FROM_DEVICE to process this
  // IOCTL_USB_GET_DESCRIPTOR_FROM_NODE_CONNECTION request.
  //
  // USBD will automatically initialize these fields:
  //     bmRequest = 0x80
  //     bRequest  = 0x06
  //
  // We must inititialize these fields:
  //     wValue    = Descriptor Type (high) and Descriptor Index (low byte)
  //     wIndex    = Zero (or Language ID for String Descriptors)
  //     wLength   = Length of descriptor buffer
  //
  stringDescReq->SetupPacket.wValue =
      (USB_STRING_DESCRIPTOR_TYPE << 8) | DescriptorIndex;

  stringDescReq->SetupPacket.wIndex = 0x0409;

  stringDescReq->SetupPacket.wLength =
      (USHORT)(nBytes - sizeof(USB_DESCRIPTOR_REQUEST));

  // Now issue the get descriptor request.
  success = DeviceIoControl(
      hHubDevice, IOCTL_USB_GET_DESCRIPTOR_FROM_NODE_CONNECTION, stringDescReq,
      nBytes, stringDescReq, nBytes, &nBytesReturned, NULL);

  size_t size = stringDesc->bLength;
  char *result = new char[size];
  wcstombs_s(NULL, result, size, stringDesc->bString, size);

  return result;
}