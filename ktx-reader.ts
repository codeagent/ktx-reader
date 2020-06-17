export type KtxInfoKeyValue = [string, Uint8Array];

export type KtxInfoTextureData = Uint8Array;

export interface KtxInfoTextureMipMap {
  imageSize: number;
  elements: KtxInfoArrayElement[];
}

export interface KtxInfoArrayElement {
  faces: KtxInfoTextureData[];
}

export interface KtxInfo {
  identifier: string;
  littleEndian: boolean;
  glType: number;
  glTypeSize: number;
  glFormat: number;
  glInternalFormat: number;
  glBaseInternalFormat: number;
  pixelWidth: number;
  pixelHeight: number;
  pixelDepth: number;
  numberOfArrayElements: number;
  numberOfFaces: number;
  numberOfMipmapLevels: number;
  keyValueData: KtxInfoKeyValue[];
  mipmaps: KtxInfoTextureMipMap[];
}

export const readKtx = (raw: ArrayBuffer): KtxInfo =>
  new KtxReader().readKtx(raw);

export class KtxReader {
  private _decoder = new TextDecoder();

  readKtx(raw: ArrayBuffer): KtxInfo {
    const view = new DataView(raw);
    let offset = 0;
    // Magic
    const identifier = this.toString(
      new Uint8Array(view.buffer, offset, offset + 15)
    );
    offset += 15;

    // Header Properties
    const endianness = new Uint8Array(view.buffer, offset, offset + 4);
    offset += 4;

    const littleEndian =
      endianness[0] === 0x01 &&
      endianness[1] === 0x02 &&
      endianness[2] === 0x03 &&
      endianness[3] === 0x04;

    const props = {} as any;
    for (let prop of [
      "glType",
      "glTypeSize",
      "glFormat",
      "glInternalFormat",
      "glBaseInternalFormat",
      "pixelWidth",
      "pixelHeight",
      "pixelDepth",
      "numberOfArrayElements",
      "numberOfFaces",
      "numberOfMipmapLevels",
      "bytesOfKeyValueData"
    ]) {
      props[prop] = view.getUint32(offset, littleEndian);
      offset += 4;
    }

    let {
      glType,
      glTypeSize,
      glFormat,
      glInternalFormat,
      glBaseInternalFormat,
      pixelWidth,
      pixelHeight,
      pixelDepth,
      numberOfArrayElements,
      numberOfFaces,
      numberOfMipmapLevels,
      bytesOfKeyValueData
    } = props;

    numberOfMipmapLevels = numberOfMipmapLevels || 1;
    numberOfArrayElements = numberOfArrayElements || 1;
    numberOfFaces = numberOfFaces || 1;
    pixelDepth = pixelDepth || 1;

    // Key-Value data
    const keyValueData: KtxInfoKeyValue[] = [];
    let keyValueBytes = 0;
    while (keyValueBytes < bytesOfKeyValueData) {
      const keyAndValueByteSize = view.getUint32(offset, littleEndian);
      offset += 4;

      const bytes = new Uint8Array(view.buffer, offset, keyAndValueByteSize);
      keyValueData.push(this.toKeyAndValue(bytes));
      offset += keyAndValueByteSize;

      // Padding
      while (view.getUint8(offset) === 0x00) {
        offset++;
      }

      keyValueBytes += keyAndValueByteSize;
    }

    const max = Math.max;

    const texelSize = FORMAT_SIZE[glFormat] * glTypeSize;
    // Mipmaps
    const mipmaps = [];
    let width = pixelWidth,
      height = pixelHeight,
      depth = pixelDepth;
    for (
      let mipMapLevel = 0;
      mipMapLevel < numberOfMipmapLevels;
      mipMapLevel++
    ) {
      const imageSize = view.getUint32(offset, littleEndian);
      offset += 4;

      const mipMap: KtxInfoTextureMipMap = { imageSize, elements: [] };

      for (
        let arrayElement = 0;
        arrayElement < numberOfArrayElements;
        arrayElement++
      ) {
        const element: KtxInfoArrayElement = { faces: [] };
        for (let face; face < numberOfFaces; face++) {
          const textureBegin = offset;
          const rowLength = width * texelSize;
          const rowPadding = 3 - ((rowLength + 3) % 4);
          const textureEnd =
            textureBegin + depth * height * (rowLength + rowPadding);

          const textureData = new Uint8Array(
            view.buffer,
            textureBegin,
            textureEnd
          );
          offset = textureEnd;

          element.faces.push(textureData);

          // cubePadding
          while (view.getUint8(offset++) === 0x00);
        }
        mipMap.elements.push(element);
      }

      mipmaps.push(mipMap);
      width = max(width / 2, 1);
      height = max(height / 2, 1);
      depth = max(depth / 2, 1);

      // mipPadding
      while (view.getUint8(offset++) === 0x00);
    }

    return {
      identifier,
      littleEndian,
      glType,
      glTypeSize,
      glFormat,
      glInternalFormat,
      glBaseInternalFormat,
      pixelWidth,
      pixelHeight,
      pixelDepth,
      numberOfArrayElements,
      numberOfFaces,
      numberOfMipmapLevels,
      keyValueData,
      mipmaps
    };
  }

  private toString(bytes: Uint8Array): string {
    return this._decoder.decode(bytes);
  }

  private toKeyAndValue(bytes: Uint8Array): [string, Uint8Array] {
    let i = 0;
    while (bytes[i++] !== 0x0);
    const key = this.toString(bytes.subarray(0, i));
    const value = bytes.subarray(i + 1);
    return [key, value];
  }

  private getTexelSize(format: number, typeSize: number) {
    return FORMAT_SIZE[format] * typeSize;
  }
}

const FORMAT_SIZE = {
  [WebGL2RenderingContext.RED]: 1,
  [WebGL2RenderingContext.RG]: 2,
  [WebGL2RenderingContext.RGB]: 3,
  [WebGL2RenderingContext.RGBA]: 4,
  [WebGL2RenderingContext.RED_INTEGER]: 1,
  [WebGL2RenderingContext.RG_INTEGER]: 2,
  [WebGL2RenderingContext.RGB_INTEGER]: 3,
  [WebGL2RenderingContext.RGBA_INTEGER]: 4
};
