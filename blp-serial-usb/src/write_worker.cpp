#include "write_worker.h"

using namespace v8;

void WriteWorker::Execute() {
  int rc = libusb_bulk_transfer(_dev_handle,
                                LIBUSB_ENDPOINT_OUT | 0x01,
                                (uint8_t *)_data_buffer,
                                _data_size,
                                &_bytes_sent,
                                0);

  if (rc < 0) {
    std::string error("Error during write bulk transfer: ");
    error += libusb_error_name(rc);
    this->SetErrorMessage(error.c_str());
  }
}
