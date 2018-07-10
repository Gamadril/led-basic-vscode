#ifndef SRC_DARWIN_LIST_H_
#define SRC_DARWIN_LIST_H_
#include <MacTypes.h>
#include <list>
#include <nan.h>
#include <string>
#include <sys/param.h> // For MAXPATHLEN

#define ERROR_STRING_SIZE 1024

NAN_METHOD(List);
void EIO_List(uv_work_t *req);
void EIO_AfterList(uv_work_t *req);

struct ListResultItem {
  std::string comName;
  std::string manufacturer;
  std::string serialNumber;
  std::string deviceName;
  int vendorId;
  int productId;
  int bcdDevice;
};

struct ListBaton {
  Nan::Callback callback;
  std::list<ListResultItem *> results;
  char errorString[ERROR_STRING_SIZE];
};

typedef struct SerialDevice {
  char port[MAXPATHLEN];
  UInt16 vendorId;
  UInt16 productId;
  UInt16 bcdDevice;
  char manufacturer[MAXPATHLEN];
  char serialNumber[MAXPATHLEN];
  char deviceName[MAXPATHLEN];
} stSerialDevice;

typedef struct DeviceListItem {
  struct SerialDevice value;
  struct DeviceListItem *next;
  int *length;
} stDeviceListItem;

#endif // SRC_DARWIN_LIST_H_
