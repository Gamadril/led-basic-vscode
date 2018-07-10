#ifndef SRC_SERIALPORT_WIN_H_
#define SRC_SERIALPORT_WIN_H_
#include <list>
#include <nan.h>
#include <string>

#define ERROR_STRING_SIZE 1024

struct WriteBaton {
  int fd;
  char *bufferData;
  size_t bufferLength;
  size_t offset;
  size_t bytesWritten;
  void *hThread;
  bool complete;
  Nan::Persistent<v8::Object> buffer;
  Nan::Callback callback;
  int result;
  char errorString[ERROR_STRING_SIZE];
};

NAN_METHOD(Write);
void EIO_Write(uv_work_t *req);
void EIO_AfterWrite(uv_async_t *req);
DWORD __stdcall WriteThread(LPVOID param);

struct ReadBaton {
  int fd;
  char *bufferData;
  size_t bufferLength;
  size_t bytesRead;
  size_t bytesToRead;
  size_t offset;
  void *hThread;
  bool complete;
  char errorString[ERROR_STRING_SIZE];
  Nan::Callback callback;
};

NAN_METHOD(Read);
void EIO_Read(uv_work_t *req);
void EIO_AfterRead(uv_async_t *req);
DWORD __stdcall ReadThread(LPVOID param);

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

#endif // SRC_SERIALPORT_WIN_H_
