/**
 * Streaming ZIP writer (STORE method — no compression).
 *
 * Files are mostly already-compressed media, so the CPU spent deflating would
 * buy little; storing them lets a multi-gigabyte folder download start
 * immediately instead of buffering. CRC-32 values are written into data
 * descriptors after each stream, which is why the local headers set bit 3.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32Update(crc: number, bytes: Uint8Array): number {
  let value = crc ^ 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    value = CRC_TABLE[(value ^ bytes[i]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}

/** DOS date/time encoding used by the ZIP spec. */
function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

export interface ZipEntry {
  /** Path inside the archive, e.g. `Reports/2026/q1.pdf`. */
  name: string;
  size: number;
  modifiedAt?: Date;
  /** Returns the bytes, or null when the object vanished (skipped gracefully). */
  open: () => Promise<ReadableStream<Uint8Array> | null>;
}

interface CentralRecord {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

function localHeader(nameBytes: Uint8Array, time: number, date: number, crcOffset: boolean): Uint8Array {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x04034b50); // local file header signature
  writeUint16(view, 4, 20); // version needed (2.0)
  // Bit 3: sizes and CRC live in the trailing data descriptor.
  writeUint16(view, 6, crcOffset ? 0x0008 : 0x0000);
  writeUint16(view, 8, 0); // STORE
  writeUint16(view, 10, time);
  writeUint16(view, 12, date);
  writeUint32(view, 14, 0); // crc32 (deferred)
  writeUint32(view, 18, 0); // compressed size (deferred)
  writeUint32(view, 22, 0); // uncompressed size (deferred)
  writeUint16(view, 26, nameBytes.length);
  writeUint16(view, 28, 0); // extra field length
  header.set(nameBytes, 30);
  return header;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  const descriptor = new Uint8Array(16);
  const view = new DataView(descriptor.buffer);
  writeUint32(view, 0, 0x08074b50); // optional signature, widely written
  writeUint32(view, 4, crc);
  writeUint32(view, 8, size);
  writeUint32(view, 12, size);
  return descriptor;
}

function centralDirectory(records: CentralRecord[]): Uint8Array {
  let size = 0;
  for (const record of records) size += 46 + record.nameBytes.length;
  const output = new Uint8Array(size + 22);
  const view = new DataView(output.buffer);

  let offset = 0;
  for (const record of records) {
    writeUint32(view, offset, 0x02014b50); // central directory signature
    writeUint16(view, offset + 4, 20); // version made by
    writeUint16(view, offset + 6, 20); // version needed
    writeUint16(view, offset + 8, 0x0008); // flags: data descriptor
    writeUint16(view, offset + 10, 0); // STORE
    writeUint16(view, offset + 12, record.time);
    writeUint16(view, offset + 14, record.date);
    writeUint32(view, offset + 16, record.crc);
    writeUint32(view, offset + 20, record.size);
    writeUint32(view, offset + 24, record.size);
    writeUint16(view, offset + 28, record.nameBytes.length);
    writeUint16(view, offset + 30, 0); // extra
    writeUint16(view, offset + 32, 0); // comment
    writeUint16(view, offset + 34, 0); // disk number
    writeUint16(view, offset + 36, 0); // internal attributes
    writeUint32(view, offset + 38, 0); // external attributes
    writeUint32(view, offset + 42, record.offset);
    output.set(record.nameBytes, offset + 46);
    offset += 46 + record.nameBytes.length;
  }

  const endOffset = offset;
  writeUint32(view, endOffset, 0x06054b50); // end of central directory
  writeUint16(view, endOffset + 4, 0);
  writeUint16(view, endOffset + 6, 0);
  writeUint16(view, endOffset + 8, records.length);
  writeUint16(view, endOffset + 10, records.length);
  writeUint32(view, endOffset + 12, size);
  writeUint32(view, endOffset + 16, offset);
  writeUint16(view, endOffset + 20, 0); // comment length
  return output;
}

/** Builds a ZIP archive as a stream, reading each entry lazily. */
export function createZipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const records: CentralRecord[] = [];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let offset = 0;
      const now = new Date();

      for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name.replace(/^\/+/, ""));
        const modified = entry.modifiedAt ?? now;
        const { time, date } = dosDateTime(modified);
        const header = localHeader(nameBytes, time, date, true);
        controller.enqueue(header);
        offset += header.length;

        const stream = await entry.open();
        let crc = 0;
        let written = 0;

        if (stream) {
          const reader = stream.getReader();
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value && value.length > 0) {
                crc = crc32Update(crc, value);
                written += value.length;
                controller.enqueue(value);
                offset += value.length;
              }
            }
          } finally {
            reader.releaseLock();
          }
        }

        const descriptor = dataDescriptor(crc, written);
        controller.enqueue(descriptor);
        offset += descriptor.length;

        records.push({ nameBytes, crc, size: written, offset: offset - written - descriptor.length - header.length, time, date });
      }

      const directory = centralDirectory(records);
      controller.enqueue(directory);
      controller.close();
    },
  });
}
