#ifndef WRITE_WORKER_H
#define WRITE_WORKER_H

#include <nan.h>
#include <libusb.h>

class WriteWorker : public Nan::AsyncWorker {
private:
  libusb_device_handle *_dev_handle;
  char *                _data_buffer;
  int32_t               _data_size;
  int32_t               _bytes_sent;

public:
  WriteWorker(libusb_device_handle *dev_handle,
              char *                data_buffer,
              int32_t               data_size,
              Nan::Callback *       callback)
      : Nan::AsyncWorker(callback, "blp-serial-usb:WriteWorker"), _dev_handle(dev_handle),
        _data_buffer(data_buffer), _data_size(data_size) {
  }

  void Execute();
};

#endif