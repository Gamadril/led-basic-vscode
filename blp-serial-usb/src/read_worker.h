#ifndef READ_WORKER_H
#define READ_WORKER_H

#include <nan.h>
#include <libusb.h>

class ReadWorker : public Nan::AsyncWorker {
private:
  libusb_device_handle *_dev_handle;
  char *                _data_buffer;
  int32_t               _bytes_read;
  int32_t               _offset;
  bool                  _stop;
  int32_t               _transfer_timeout;

public:
  ReadWorker(libusb_device_handle *dev_handle,
             char *                data_buffer,
             int32_t               offset,
             int32_t               timeout,
             Nan::Callback *       callback)
      : Nan::AsyncWorker(callback, "blp-serial-usb:ReadWorker"), _dev_handle(dev_handle),
        _data_buffer(data_buffer), _bytes_read(0), _offset(offset), _stop(false),
        _transfer_timeout(timeout) {
  }

  void Execute();
  void HandleOKCallback();
  void stop();
};

#endif