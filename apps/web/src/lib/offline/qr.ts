/**
 * Generador de código QR sin dependencias (QR Code Model 2, modo byte/UTF-8).
 *
 * ¿Por qué propio? El boleto digital debe mostrar su QR **sin conexión** y no
 * podemos añadir paquetes npm en este entorno. Esta implementación es compacta,
 * estándar (ISO/IEC 18004) y suficiente para una URL de verificación.
 *
 * Uso: `qrMatrix(text)` -> matriz booleana cuadrada (true = módulo negro).
 * El render a SVG vive en el componente `QrCode`.
 *
 * Basado en el algoritmo de referencia de Project Nayuki (dominio público),
 * reescrito de forma minimalista para byte mode + corrección de errores.
 */

// ── Tablas de la especificación ──────────────────────────────────────────────
// Número de codewords de corrección de error por bloque, por (versión, nivel ECC).
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  // L, M, Q, H  (índice 0 sin usar; versiones 1..40)
  [-1, 7, 10, 13, 17, 10, 17, 22, 28, 30, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // H
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // H
];

type Ecc = 0 | 1 | 2 | 3; // L=0, M=1, Q=2, H=3

// ── Aritmética en GF(256) para Reed-Solomon ──────────────────────────────────
function reedSolomonDivisor(degree: number): number[] {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// ── Capacidad por versión ────────────────────────────────────────────────────
function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function getNumDataCodewords(ver: number, ecc: Ecc): number {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecc][ver]
  );
}

// ── Codificación de los datos (modo byte) ────────────────────────────────────
function encodeText(text: string): number[] {
  // UTF-8
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const lo = text.charCodeAt(++i);
      cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
    }
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
  }
  return bytes;
}

class BitBuffer {
  bits: number[] = [];
  append(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  }
}

// ── Construcción de la matriz ────────────────────────────────────────────────
class QrBuilder {
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];

  constructor(public version: number, public ecc: Ecc, dataCodewords: number[]) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));

    this.drawFunctionPatterns();
    const allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);
    const mask = this.chooseBestMask();
    this.applyMask(mask);
    this.drawFormatBits(mask);
  }

  private setFunc(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  private drawFunctionPatterns() {
    const size = this.size;
    for (let i = 0; i < size; i++) {
      this.setFunc(6, i, i % 2 === 0);
      this.setFunc(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);

    const alignPos = this.alignmentPatternPositions();
    const n = alignPos.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.drawAlignment(alignPos[i], alignPos[j]);
      }

    this.drawFormatBits(0); // placeholder; final se dibuja tras escoger máscara
    this.drawVersion();
  }

  private drawFinder(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size)
          this.setFunc(x, y, dist !== 2 && dist !== 4);
      }
  }

  private drawAlignment(cx: number, cy: number) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        this.setFunc(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  private alignmentPatternPositions(): number[] {
    const ver = this.version;
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  private drawFormatBits(mask: number) {
    // El campo de formato NO usa el índice interno de ECC, sino su código de
    // 2 bits estándar: M=00, L=01, H=10, Q=11 (nuestro índice es L=0,M=1,Q=2,H=3).
    const eccFormatBits = [1, 0, 3, 2][this.ecc];
    const data = (eccFormatBits << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) this.setFunc(8, i, ((bits >>> i) & 1) !== 0);
    this.setFunc(8, 7, ((bits >>> 6) & 1) !== 0);
    this.setFunc(8, 8, ((bits >>> 7) & 1) !== 0);
    this.setFunc(7, 8, ((bits >>> 8) & 1) !== 0);
    for (let i = 9; i < 15; i++) this.setFunc(14 - i, 8, ((bits >>> i) & 1) !== 0);
    for (let i = 0; i < 8; i++) this.setFunc(this.size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
    for (let i = 8; i < 15; i++) this.setFunc(8, this.size - 15 + i, ((bits >>> i) & 1) !== 0);
    this.setFunc(8, this.size - 8, true); // módulo oscuro siempre
  }

  private drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunc(a, b, bit);
      this.setFunc(b, a, bit);
    }
  }

  private addEccAndInterleave(data: number[]): number[] {
    const ver = this.version;
    const ecc = this.ecc;
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc][ver];
    const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks: number[][] = [];
    const rsDiv = reedSolomonDivisor(blockEccLen);
    let k = 0;
    for (let i = 0; i < numBlocks; i++) {
      const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      const dat = data.slice(k, k + datLen);
      k += datLen;
      const eccBytes = reedSolomonRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(eccBytes));
    }

    const result: number[] = [];
    for (let i = 0; i < blocks[0].length; i++)
      for (let j = 0; j < blocks.length; j++)
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(blocks[j][i]);
    return result;
  }

  private drawCodewords(data: number[]) {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  private applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        let invert = false;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
  }

  private chooseBestMask(): number {
    let best = 0;
    let bestPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      this.applyMask(m);
      this.drawFormatBits(m);
      const p = this.penaltyScore();
      if (p < bestPenalty) {
        bestPenalty = p;
        best = m;
      }
      this.applyMask(m); // deshacer (XOR es involutivo)
    }
    return best;
  }

  private penaltyScore(): number {
    let result = 0;
    const size = this.size;
    const mod = this.modules;
    // Reglas simplificadas (suficientes para escoger una máscara legible).
    for (let y = 0; y < size; y++) {
      let run = 0;
      let last = false;
      for (let x = 0; x < size; x++) {
        if (mod[y][x] === last) {
          run++;
          if (run === 5) result += 3;
          else if (run > 5) result++;
        } else {
          run = 1;
          last = mod[y][x];
        }
      }
    }
    for (let x = 0; x < size; x++) {
      let run = 0;
      let last = false;
      for (let y = 0; y < size; y++) {
        if (mod[y][x] === last) {
          run++;
          if (run === 5) result += 3;
          else if (run > 5) result++;
        } else {
          run = 1;
          last = mod[y][x];
        }
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) dark++;
    const total = size * size;
    const ratio = Math.abs(dark * 20 - total * 10) / total;
    result += Math.floor(ratio) * 10;
    return result;
  }
}

/**
 * Devuelve la matriz booleana del QR para `text` (true = módulo oscuro).
 * Escoge automáticamente la versión más pequeña con nivel de corrección M.
 * Lanza si el texto no cabe (no debería para una URL de verificación).
 */
export function qrMatrix(text: string, ecc: Ecc = 1): boolean[][] {
  const dataBytes = encodeText(text);

  // Buscar la versión mínima que admita estos bytes en modo byte.
  let version = 1;
  for (; version <= 40; version++) {
    const capacityBits = getNumDataCodewords(version, ecc) * 8;
    const charCountBits = version < 10 ? 8 : 16;
    const usedBits = 4 + charCountBits + dataBytes.length * 8;
    if (usedBits <= capacityBits) break;
  }
  if (version > 40) throw new Error('Texto demasiado largo para un QR');

  const bb = new BitBuffer();
  bb.append(0b0100, 4); // modo byte
  bb.append(dataBytes.length, version < 10 ? 8 : 16);
  for (const b of dataBytes) bb.append(b, 8);

  const dataCapacityBits = getNumDataCodewords(version, ecc) * 8;
  // Terminador + relleno a byte
  bb.append(0, Math.min(4, dataCapacityBits - bb.bits.length));
  while (bb.bits.length % 8 !== 0) bb.bits.push(0);
  // Bytes de relleno alternados
  for (let pad = 0xec; bb.bits.length < dataCapacityBits; pad ^= 0xec ^ 0x11) bb.append(pad, 8);

  const dataCodewords: number[] = [];
  for (let i = 0; i < bb.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.bits[i + j];
    dataCodewords.push(byte);
  }

  return new QrBuilder(version, ecc, dataCodewords).modules;
}
