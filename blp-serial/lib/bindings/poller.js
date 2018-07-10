'use strict';
const EventEmitter = require('events');
const path = require('path');
const binding = require('../native_loader').load(path.join(__dirname, 'native'));
const FDPoller = binding.Poller;

const EVENTS = {
  UV_READABLE: 1,
  UV_WRITABLE: 2,
  UV_DISCONNECT: 4
};

function handleEvent(error, eventFlag) {
  if (error) {
    this.emit('readable', error);
    this.emit('writable', error);
    this.emit('disconnect', error);
    return;
  }
  if (eventFlag & EVENTS.UV_READABLE) {
    this.emit('readable', null);
  }
  if (eventFlag & EVENTS.UV_WRITABLE) {
    this.emit('writable', null);
  }
  if (eventFlag & EVENTS.UV_DISCONNECT) {
    this.emit('disconnect', null);
  }
}

/**
 * Polls unix systems for readable or writable states of a file or serialport
 */
class Poller extends EventEmitter {
  constructor(fd) {
    super();
    this.poller = new FDPoller(fd, handleEvent.bind(this));
  }
  /**
   * Wait for the next event to occur
   * @param {string} event ('readable'|'writable'|'disconnect')
   * @returns {Poller} returns itself
   */
  once(event) {
    switch (event) {
      case 'readable':
        this.poll(EVENTS.UV_READABLE);
        break;
      case 'writable':
        this.poll(EVENTS.UV_WRITABLE);
        break;
      case 'disconnect':
        this.poll(EVENTS.UV_DISCONNECT);
        break;
    }
    return EventEmitter.prototype.once.apply(this, arguments);
  }

  /**
   * Ask the bindings to listen for an event, it is recommend to use `.once()` for easy use
   * @param {EVENTS} eventFlag polls for an event or group of events based upon a flag.
   * @returns {undefined}
   */
  poll(eventFlag) {
    eventFlag = eventFlag || 0;
    this.poller.poll(eventFlag);
  }

  /**
   * Stop listening for events and cancel all outstanding listening with an error
   * @returns {undefined}
   */
  stop() {
    this.poller.stop();
    const err = new Error('Canceled');
    err.canceled = true;
    this.emit('readable', err);
    this.emit('writable', err);
    this.emit('disconnect', err);
  }
};

Poller.EVENTS = EVENTS;

module.exports = Poller;
