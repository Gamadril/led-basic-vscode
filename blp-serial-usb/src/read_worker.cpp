#include "read_worker.h"

using namespace v8;

void ReadWorker::Execute() {
  int     rc;
  uint8_t in[64];

  while (!_stop) {
    rc = libusb_bulk_transfer(
        _dev_handle, LIBUSB_ENDPOINT_IN | 0x01, in, sizeof(in), &_bytes_read, _transfer_timeout);

    if (_bytes_read == 0 || _stop) {
    //if (rc == LIBUSB_ERROR_TIMEOUT) {
      continue;
    }

    if (rc < 0) {
      std::string error("Error during read bulk transfer: ");
      error += libusb_error_name(rc);
      this->SetErrorMessage(error.c_str());
    } else {
      //printf("ReadWorker: read %d bytes\n", _bytes_read);
      memcpy(_data_buffer + _offset, in, _bytes_read);
      _stop = true;
    }
  }
  //printf("ReadWorker finished!\n");
}

void ReadWorker::HandleOKCallback() {
  Nan::HandleScope scope;

  Local<Value> argv[] = {Nan::Null(), Nan::New<Integer>(_bytes_read)};
  Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 2, argv);
}

void ReadWorker::stop() {
  _stop = true;
}