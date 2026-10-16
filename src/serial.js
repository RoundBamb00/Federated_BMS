import { COMMANDS } from './protocol.js';

export class SerialConnection {
  constructor(api, { onData = () => {}, onState = () => {}, onError = () => {} } = {}) {
    Object.assign(this, { api, onData, onState, onError, state: 'closed' });
  }
  setState(state) { this.state = state; this.onState(state); }
  async connect(baudRate) {
    if (this.state !== 'closed') throw new Error('Connection is busy');
    this.setState('connecting');
    let opened = false;
    try {
      this.port = await this.api.requestPort();
      if (this.state !== 'connecting') {
        this.port = null; this.setState('closed'); return;
      }
      await this.port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
      opened = true;
      if (this.state !== 'connecting') {
        await this.port.close(); this.port = null; this.setState('closed'); return;
      }
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.setState('open');
      this.readTask = this.readLoop();
    } catch (error) {
      if (this.reader) { await this.reader.cancel().catch(() => {}); this.reader.releaseLock(); this.reader = null; }
      if (opened) await this.port.close().catch(() => {});
      this.port = null;
      this.setState('closed');
      throw error;
    }
  }
  async readLoop() {
    try {
      while (this.state === 'open') {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.onData(value);
      }
    } catch (error) {
      if (this.state === 'open') this.onError(error);
    } finally {
      this.setState('closing');
      this.reader.releaseLock(); this.reader = null;
      if (this.pendingWrite) await this.pendingWrite.catch(() => {});
      this.writer.releaseLock(); this.writer = null;
      try { await this.port.close(); } catch (error) { this.onError(error); }
      this.port = null;
      this.setState('closed');
    }
  }
  async send(command) {
    if (this.state !== 'open' || !this.writer) throw new Error('Serial port is not open');
    if (!Object.hasOwn(COMMANDS, command)) throw new Error('Unknown command');
    if (this.pendingWrite) throw new Error('A command is still being sent');
    this.pendingWrite = this.writer.write(Uint8Array.from(COMMANDS[command]));
    try { await this.pendingWrite; } finally { this.pendingWrite = null; }
  }
  async disconnect() {
    if (this.state === 'connecting') {
      // A chooser cannot be aborted; connect() checks this after each await.
      this.setState('closing');
      return;
    }
    if (this.state === 'open') {
      this.setState('closing');
      await this.reader.cancel().catch(() => {});
    }
    await this.readTask;
  }
}
