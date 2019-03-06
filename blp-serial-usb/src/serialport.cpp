#include "read_worker.h"
#include "write_worker.h"
#include <chrono>
#include <nan.h>
#include <node.h>
#include <node_buffer.h>
#include <sstream>
#include <stdlib.h>
#include <string>
#include <thread>

#define READ_TRANSFER_TIMEOUT_MS 200

#ifdef WIN32
#define strncasecmp strnicmp
#endif

using namespace node;
using namespace v8;

static Nan::Persistent<FunctionTemplate> constructor;

Local<Value> getValueFromObject(Local<Object> options, std::string key) {
  Local<String> v8str = Nan::New<String>(key).ToLocalChecked();
  return Nan::Get(options, v8str).ToLocalChecked();
}

int getIntFromObject(Local<Object> options, std::string key) {
  return Nan::To<Int32>(getValueFromObject(options, key)).ToLocalChecked()->Value();
}

bool getBoolFromObject(Local<Object> options, std::string key) {
  return Nan::To<Boolean>(getValueFromObject(options, key)).ToLocalChecked()->Value();
}

Local<String> getStringFromObject(Local<Object> options, std::string key) {
  return Nan::To<String>(getValueFromObject(options, key)).ToLocalChecked();
}

double getDoubleFromObject(Local<Object> options, std::string key) {
  return Nan::To<double>(getValueFromObject(options, key)).FromMaybe(0);
}

void EventsThread(void *arg);

class SerialPort : public Nan::ObjectWrap {
public:
  libusb_context *      usb_context;
  libusb_device_handle *dev_handle;
  char *                in_data_buffer;
  ReadWorker *          read_worker;

  SerialPort() : usb_context(NULL), dev_handle(NULL) {
  }

  ~SerialPort() {
  }

  static NAN_METHOD(Open) {
    Nan::HandleScope scope;
    int              res;
    SerialPort *     obj = Nan::ObjectWrap::Unwrap<SerialPort>(info.This());

    // path
    if (!info[0]->IsString()) {
      return Nan::ThrowTypeError("First argument must be a string");
    }
    Local<String> path_string =
        info[0]->ToString(Nan::GetCurrentContext()).FromMaybe(Local<String>());
    Nan::Utf8String path(path_string);

    // options
    if (!info[1]->IsObject()) {
      return Nan::ThrowTypeError("Second argument must be an object");
    }
    Local<Object> options = info[1]->ToObject(Nan::GetCurrentContext()).FromMaybe(Local<Object>());

    // callback
    if (!info[2]->IsFunction()) {
      return Nan::ThrowTypeError("Third argument must be a function");
    }

    Nan::Callback callback(info[2].As<Function>());
    Local<Value>  argv[1];
    argv[0] = Nan::Null();

    if (obj->dev_handle) {
      std::string error("port already open");
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    // split path e.g usb:0x16c0:0x2aaf:0
    std::string              devpath(*path);
    std::stringstream        ss(devpath);
    std::string              item;
    std::vector<std::string> parts;
    while (std::getline(ss, item, ':')) {
      parts.push_back(item);
    }
    int deviceIndex = std::stoi(parts[3]);
    int vid         = std::stoi(parts[1], 0, 16);
    int pid         = std::stoi(parts[2], 0, 16);

    if (vid != 0x16c0) {
      std::string error("Only BLP devices supported.");
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    res = libusb_init(&obj->usb_context);
    if (res != LIBUSB_SUCCESS) {
      std::string error("libusb init error: ");
      error += libusb_error_name(res);
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    libusb_device **list;
    int32_t         count = libusb_get_device_list(obj->usb_context, &list);

    int            found       = 0;
    libusb_device *foundDevice = NULL;
    for (int32_t i = 0; i < count; i++) {
      libusb_device *          device = list[i];
      libusb_device_descriptor desc   = {};

      libusb_get_device_descriptor(device, &desc);

      if (desc.idVendor == vid && desc.idProduct == pid) {
        if (deviceIndex == found) {
          foundDevice = device;
          break;
        } else {
          found++;
        }
      }
    }

    if (foundDevice) {
      res = libusb_open(foundDevice, &obj->dev_handle);
      if (res != LIBUSB_SUCCESS) {
        libusb_free_device_list(list, 1);
        std::string error("libusb open error: ");
        error += libusb_error_name(res);
        argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
        Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
        return;
      }
    } else {
      libusb_free_device_list(list, 1);
      std::string error("device not found");
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }
    libusb_free_device_list(list, 1);

    /*
        res = libusb_set_configuration(obj->dev_handle, 1);
        if (res != LIBUSB_SUCCESS) {
          std::string error("libusb set configuration error: ");
          error += libusb_error_name(res);
          argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
          Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
          return;
        }
        */

    res = libusb_claim_interface(obj->dev_handle, 1);
    if (res != LIBUSB_SUCCESS) {
      std::string error("libusb claiming interface 1 error: ");
      error += libusb_error_name(res);
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    /*
        // set line state
        rc = libusb_control_transfer(
            obj->dev_handle, 0x21, 0x22, ACM_CTRL_DTR | ACM_CTRL_RTS, 0, NULL, 0, 0);
        if (rc < 0) {
          fprintf(stderr, "Error during control transfer: %s\n", libusb_error_name(rc));
        }
    */

    // baudrate, stopbits, parity, databits
    int     baudrate    = getIntFromObject(options, "baudRate");
    uint8_t databits    = getIntFromObject(options, "dataBits");
    double  stopBitsDbl = getDoubleFromObject(options, "stopBits");
    uint8_t stopBits    = 0;
    if (stopBitsDbl > 1.4 && stopBitsDbl < 1.6) {
      stopBits = 1;
    }
    if (stopBitsDbl == 2) {
      stopBits = 2;
    }

    Local<String>   v8str = getStringFromObject(options, "parity");
    Nan::Utf8String str(v8str);
    size_t          strsize = strlen(*str);
    uint8_t         parity  = 0;
    if (!strncasecmp(*str, "even", strsize)) {
      parity = 2;
    } else if (!strncasecmp(*str, "mark", strsize)) {
      parity = 3;
    } else if (!strncasecmp(*str, "odd", strsize)) {
      parity = 1;
    } else if (!strncasecmp(*str, "space", strsize)) {
      parity = 4;
    }

    uint8_t reqData[] = {(uint8_t)(baudrate & 0xFF),
                         (uint8_t)((baudrate >> 8) & 0xFF),
                         (uint8_t)((baudrate >> 16) & 0xFF),
                         (uint8_t)((baudrate >> 24) & 0xFF),
                         stopBits,  // stopbits
                         parity,    // parity
                         databits}; // data bits

    res = libusb_control_transfer(obj->dev_handle,
                                  LIBUSB_REQUEST_TYPE_CLASS | LIBUSB_RECIPIENT_INTERFACE,
                                  0x20,
                                  0,
                                  0,
                                  reqData,
                                  sizeof(reqData),
                                  0);
    if (res < 0) {
      std::string error("Error during control transfer: ");
      error += libusb_error_name(res);
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
  }

  static NAN_METHOD(New) {
    Nan::HandleScope scope;

    if (!info.IsConstructCall())
      return Nan::ThrowError("Use 'new' to create instances of this object");

    SerialPort *obj = new SerialPort();
    obj->Wrap(info.This());

    info.GetReturnValue().Set(info.This());
  }

  static NAN_METHOD(Read) {
    Nan::HandleScope scope;
    SerialPort *     obj = Nan::ObjectWrap::Unwrap<SerialPort>(info.This());

    // buffer
    if (!info[0]->IsObject() || !node::Buffer::HasInstance(info[0])) {
      Nan::ThrowTypeError("First argument must be a buffer");
      return;
    }
    Local<Object> buffer = info[0]->ToObject(Nan::GetCurrentContext()).FromMaybe(Local<Object>());
    int32_t       buffer_size = node::Buffer::Length(buffer);

    // offset
    if (!info[1]->IsInt32()) {
      Nan::ThrowTypeError("Second argument must be an int");
      return;
    }
    int offset = Nan::To<Int32>(info[1]).ToLocalChecked()->Value();

    // bytes to read
    if (!info[2]->IsInt32()) {
      Nan::ThrowTypeError("Third argument must be an int");
      return;
    }
    int32_t bytesToRead = Nan::To<Int32>(info[2]).ToLocalChecked()->Value();

    if (bytesToRead + offset > buffer_size) {
      Nan::ThrowTypeError("'bytesToRead' + 'offset' cannot be larger than the buffer's length");
      return;
    }

    // callback
    if (!info[3]->IsFunction()) {
      return Nan::ThrowTypeError("Fourth argument must be a function");
    }

    Nan::Callback *callback = new Nan::Callback(Nan::To<Function>(info[3]).ToLocalChecked());
    obj->in_data_buffer     = node::Buffer::Data(buffer);

    if (obj->dev_handle == NULL) {
      std::string  error("port not opened");
      Local<Value> argv[2];
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      argv[1] = Nan::Null();
      Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 2, argv);
      return;
    }

    obj->read_worker = new ReadWorker(
        obj->dev_handle, obj->in_data_buffer, offset, READ_TRANSFER_TIMEOUT_MS, callback);

    AsyncQueueWorker(obj->read_worker);
  }

  static NAN_METHOD(Write) {
    Nan::HandleScope scope;
    SerialPort *     obj = Nan::ObjectWrap::Unwrap<SerialPort>(info.This());

    // buffer
    if (!info[0]->IsObject() || !node::Buffer::HasInstance(info[0])) {
      Nan::ThrowTypeError("First argument must be a buffer");
      return;
    }
    Local<Object> buffer = info[0]->ToObject(Nan::GetCurrentContext()).FromMaybe(Local<Object>());
    char *        buffer_data = node::Buffer::Data(buffer);
    int32_t       buffer_size = node::Buffer::Length(buffer);

    // callback
    if (!info[1]->IsFunction()) {
      return Nan::ThrowTypeError("Second argument must be a function");
    }

    Nan::Callback *callback = new Nan::Callback(Nan::To<Function>(info[1]).ToLocalChecked());

    if (obj->dev_handle == NULL) {
      std::string  error("port not opened");
      Local<Value> argv[1];
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback->GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    AsyncQueueWorker(new WriteWorker(obj->dev_handle, buffer_data, buffer_size, callback));
  }

  static NAN_METHOD(Close) {
    int              res;
    Nan::HandleScope scope;
    SerialPort *     obj = Nan::ObjectWrap::Unwrap<SerialPort>(info.This());

    // callback
    if (!info[0]->IsFunction()) {
      return Nan::ThrowTypeError("First argument must be a function");
    }

    Nan::Callback callback(info[0].As<v8::Function>());
    Local<Value>  argv[1] = {Nan::Null()};

    if (obj->dev_handle == NULL) {
      std::string error("port not opened");
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    // stop the read worker
    if (obj->read_worker) {
      obj->read_worker->stop();
      std::this_thread::sleep_for(std::chrono::milliseconds(READ_TRANSFER_TIMEOUT_MS * 2));
      obj->read_worker = NULL;
    }

    res = libusb_release_interface(obj->dev_handle, 1);
    if (res != LIBUSB_SUCCESS) {
      std::string error("libusb releasing interface 1 error: ");
      error += libusb_error_name(res);
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    libusb_close(obj->dev_handle);
    obj->dev_handle = NULL;

    libusb_exit(obj->usb_context);
    obj->usb_context = NULL;

    Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
  }

  static NAN_METHOD(Set) {
    Nan::HandleScope scope;
    int              res;
    SerialPort *     obj = Nan::ObjectWrap::Unwrap<SerialPort>(info.This());

    // options
    if (!info[0]->IsObject()) {
      Nan::ThrowTypeError("First argument must be an object");
      return;
    }
    Local<Object> options = info[0]->ToObject(Nan::GetCurrentContext()).FromMaybe(Local<Object>());

    // callback
    if (!info[1]->IsFunction()) {
      return Nan::ThrowTypeError("Second argument must be a function");
    }

    Nan::Callback callback(info[1].As<v8::Function>());
    Local<Value>  argv[1];
    argv[0] = Nan::Null();

    if (obj->dev_handle == NULL) {
      std::string error("port not opened");
      argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
      Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
      return;
    }

    Local<Value> val;
    bool         optVal;

    val = getValueFromObject(options, "brk");
    if (val->IsBoolean()) {
      Local<Boolean> lbool = val->ToBoolean(Nan::GetCurrentContext()).FromMaybe(Local<Boolean>());
      optVal               = lbool->Value();

      res = libusb_control_transfer(obj->dev_handle,
                                    LIBUSB_REQUEST_TYPE_CLASS | LIBUSB_RECIPIENT_INTERFACE,
                                    0x23,
                                    optVal ? 0xFFFF : 0,
                                    0,
                                    NULL,
                                    0,
                                    0);
      if (res < 0) {
        std::string error("Error during BRK control transfer: ");
        error += libusb_error_name(res);
        argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
        Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
        return;
      }
    }

    val = getValueFromObject(options, "dtr");
    if (val->IsBoolean()) {
      Local<Boolean> lbool = val->ToBoolean(Nan::GetCurrentContext()).FromMaybe(Local<Boolean>());
      optVal               = lbool->Value();

      res = libusb_control_transfer(obj->dev_handle,
                                    LIBUSB_REQUEST_TYPE_CLASS | LIBUSB_RECIPIENT_INTERFACE,
                                    0x22,
                                    optVal ? 1 : 0,
                                    0,
                                    NULL,
                                    0,
                                    0);
      if (res < 0) {
        std::string error("Error during DTR control transfer: ");
        error += libusb_error_name(res);
        argv[0] = Exception::Error(Nan::New<String>(error).ToLocalChecked());
        Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
        return;
      }
    }

    /*
    bool brk = getBoolFromObject(options, "brk");
    bool rts = getBoolFromObject(options, "rts");
    bool cts = getBoolFromObject(options, "cts");
    bool dtr = getBoolFromObject(options, "dtr");
    bool dsr = getBoolFromObject(options, "dsr");
    */

    Nan::Call(callback.GetFunction(), Nan::GetCurrentContext()->Global(), 1, argv);
  }

  static void Initialize(Handle<Object> target) {
    Nan::HandleScope scope;

    Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>(New);

    constructor.Reset(tpl);
    tpl->InstanceTemplate()->SetInternalFieldCount(1);
    tpl->SetClassName(Nan::New<String>("SerialPort").ToLocalChecked());

    Nan::SetPrototypeMethod(tpl, "open", Open);
    Nan::SetPrototypeMethod(tpl, "close", Close);
    Nan::SetPrototypeMethod(tpl, "set", Set);
    Nan::SetPrototypeMethod(tpl, "write", Write);
    Nan::SetPrototypeMethod(tpl, "read", Read);

    target->Set(Nan::New<String>("SerialPort").ToLocalChecked(), tpl->GetFunction());
  }
};

static NAN_METHOD(ListDevices) {
  Nan::HandleScope scope;

  int             res;
  libusb_context *ctx = NULL;
  Local<Array>    blpDevices;
  Local<Object>   blpDevice;

  res = libusb_init(&ctx);

  if (res != LIBUSB_SUCCESS) {
    return Nan::ThrowError((std::string("libusb init error: ") + libusb_error_name(res)).c_str());
  }

  libusb_device **list;

  int32_t count = libusb_get_device_list(ctx, &list);

  blpDevices    = Nan::New<Array>();
  uint8_t index = 0;
  for (int32_t i = 0; i < count; i++) {
    libusb_device *          device = list[i];
    libusb_device_descriptor desc   = {};
    libusb_device_handle *   handle = NULL;

    libusb_get_device_descriptor(device, &desc);

    if (desc.idVendor == 0x16c0) {
      blpDevice = Nan::New<Object>();
      uint8_t string[256];

      res = libusb_open(device, &handle);
      if (res == LIBUSB_SUCCESS) {
        if (desc.iManufacturer) {
          res = libusb_get_string_descriptor_ascii(
              handle, desc.iManufacturer, string, sizeof(string));
          if (res > 0) {
            blpDevice->Set(Nan::New<String>("manufacturer").ToLocalChecked(),
                           Nan::New<String>((char *)string).ToLocalChecked());
          }
        }

        if (desc.iSerialNumber) {
          res = libusb_get_string_descriptor_ascii(
              handle, desc.iSerialNumber, string, sizeof(string));
          if (res > 0) {
            blpDevice->Set(Nan::New<String>("serialNumber").ToLocalChecked(),
                           Nan::New<String>((char *)string).ToLocalChecked());
          }
        }

        if (desc.iProduct) {
          res = libusb_get_string_descriptor_ascii(handle, desc.iProduct, string, sizeof(string));
          if (res > 0) {
            blpDevice->Set(Nan::New<String>("deviceName").ToLocalChecked(),
                           Nan::New<String>((char *)string).ToLocalChecked());
          }
        }

        libusb_close(handle);
      } else {
        // assume it's a regular com port without WinUSB driver, libUSB cannot open it
        //return Nan::ThrowError((std::string("libusb open error: ") + libusb_error_name(res)).c_str());
        continue;
      }

      blpDevice->Set(Nan::New<String>("vendorId").ToLocalChecked(),
                     Nan::New<Integer>(desc.idVendor));
      blpDevice->Set(Nan::New<String>("productId").ToLocalChecked(),
                     Nan::New<Integer>(desc.idProduct));
      blpDevice->Set(Nan::New<String>("bcdDevice").ToLocalChecked(),
                     Nan::New<Integer>(desc.bcdDevice));

      uint8_t       countSameId = 0;
      Local<String> strPid      = Nan::New<String>("productId").ToLocalChecked();
      for (uint8_t idx = 0; idx < blpDevices->Length(); idx++) {
        Local<Object> dev_obj =
            blpDevices->Get(idx)->ToObject(Nan::GetCurrentContext()).FromMaybe(Local<Object>());
        // Local<Value> val = Nan::Get(blpDevices->Get(idx)->ToObject(), strPid).ToLocalChecked();
        Local<Value> val = Nan::Get(dev_obj, strPid).ToLocalChecked();
        int          pid = Nan::To<Int32>(val).ToLocalChecked()->Value();
        if (pid == desc.idProduct) {
          countSameId++;
        }
      }

      std::stringstream ss;
      ss << std::hex << "usb:" << desc.idVendor << ":" << desc.idProduct << ":"
         << std::to_string(countSameId);
      blpDevice->Set(Nan::New<String>("comName").ToLocalChecked(),
                     Nan::New<String>(ss.str()).ToLocalChecked());

      blpDevices->Set(Nan::New<Integer>(index), blpDevice);
      index++;
    }
  }

  libusb_free_device_list(list, 1);
  libusb_exit(ctx);

  info.GetReturnValue().Set(blpDevices);
}

extern "C" {
void init(Handle<Object> target) {
  Nan::HandleScope scope;
  SerialPort::Initialize(target);
  target->Set(Nan::New<String>("list").ToLocalChecked(),
              Nan::New<FunctionTemplate>(ListDevices)->GetFunction());
}

NODE_MODULE(serialport, init);
}