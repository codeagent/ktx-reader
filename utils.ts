import { vec2, vec3, vec4 } from "gl-matrix";
import * as glMatrix from "gl-matrix";
import { Mesh, VertexAttribute } from "./graphics";

export interface StreamVertexAttribute {
  index: number;
  value: number | vec2 | vec3 | vec4 | number[];
}

const sign = Math.sign;

export class VertexAttributeStream
  implements IterableIterator<StreamVertexAttribute> {
  private _i = 0;
  private _indexView: ArrayLike<number>;
  private _dataView: DataView;
  private _componentSize: number = 4;

  constructor(mesh: Mesh, private attribute: VertexAttribute) {
    this._indexView = new Uint16Array(
      mesh.indexData.buffer,
      mesh.indexData.byteOffset,
      mesh.indexData.byteLength / 2
    );

    this._dataView = new DataView(
      mesh.vertexData.buffer,
      mesh.vertexData.byteOffset + attribute.offset
    );
  }

  [Symbol.iterator](): IterableIterator<StreamVertexAttribute> {
    this._i = 0;
    return this;
  }

  next(): IteratorResult<StreamVertexAttribute> {
    if (this._i >= this._indexView.length) {
      return { done: true, value: null };
    } else {
      const index = this._indexView[this._i++];
      const byteOffset = this.attribute.stride * index;
      let value;
      if (this.attribute.size > 1) {
        value = Array.from(new Array(this.attribute.size)).map((_, i) =>
          this._dataView.getFloat32(byteOffset + i * this._componentSize)
        );
      } else {
        value = this._dataView.getFloat32(byteOffset);
      }

      return { done: false, value: { value, index } };
    }
  }
}

export interface StreamVertex {
  index: number;
  [attribute: string]: number | vec2 | vec3 | vec4 | number[];
}

export class VertexStream implements IterableIterator<StreamVertex> {
  private _attributeStream: { [name: string]: VertexAttributeStream } = {};

  constructor(private mesh: Mesh) {
    for (let a of this.mesh.vertexFormat) {
      this._attributeStream[a.semantics] = new VertexAttributeStream(mesh, a);
    }
  }

  [Symbol.iterator](): IterableIterator<StreamVertex> {
    Object.entries(this._attributeStream).forEach(([, stream]) =>
      stream[Symbol.iterator]()
    );
    return this;
  }

  next(): IteratorResult<StreamVertex> {
    const results: [
      string,
      IteratorResult<StreamVertexAttribute>
    ][] = Object.entries(this._attributeStream).map(([name, stream]) => [
      name,
      stream.next()
    ]);

    if (results.some(([, r]) => r.done)) {
      return { done: true, value: null };
    } else {
      const index = results[0][1].value.index;
      const entries = results.map(([name, result]) => [
        name,
        result.value.value
      ]);
      return { done: false, value: { ...Object.fromEntries(entries), index } };
    }
  }
}

export type StreamTriangle = [StreamVertex, StreamVertex, StreamVertex];

export class TriangleStream implements IterableIterator<StreamTriangle> {
  private _vertexStream: VertexStream;
  private _vertexStreamIterator: IterableIterator<StreamVertex>;

  constructor(mesh: Mesh) {
    this._vertexStream = new VertexStream(mesh);
  }

  [Symbol.iterator](): IterableIterator<StreamTriangle> {
    this._vertexStreamIterator = this._vertexStream[Symbol.iterator]();
    return this;
  }

  next(): IteratorResult<StreamTriangle> {
    const t = [
      this._vertexStreamIterator.next(),
      this._vertexStreamIterator.next(),
      this._vertexStreamIterator.next()
    ];
    if (t.some(t => t.done)) {
      return { done: true, value: null };
    } else {
      return { done: false, value: t.map(v => v.value) as StreamTriangle };
    }
  }
}

export const calculateTangents = (mesh: Mesh, slot = 3): Mesh => {
  const mult = glMatrix.vec3.scale;
  const sub = glMatrix.vec3.sub;
  const sub2 = glMatrix.vec2.sub;
  const add = glMatrix.vec3.add;
  const cross = glMatrix.vec3.cross;
  const dot = glMatrix.vec3.dot;
  const normalize = glMatrix.vec3.normalize;

  class Edge {
    pos = glMatrix.vec3.create();
    uv = glMatrix.vec2.create();
  }

  if (
    !mesh.vertexFormat.find(a => a.semantics === "position") ||
    !mesh.vertexFormat.find(a => a.semantics === "uv")
  ) {
    throw new Error(
      'Failed to calculate tangents: "position" and "uv" attributes are required'
    );
  }

  let data = [];
  const processed = new Set<number>();
  const tb = [];

  let X: Edge = new Edge();
  let Y: Edge = new Edge();

  const aux = glMatrix.vec3.create();
  const triangleStream = new TriangleStream(mesh);
  for (const tri of triangleStream) {
    console.log(tri);
    for (let j = 0; j < 3; j++) {
      if (processed.has(tri[j].index)) {
        continue;
      }

      sub(
        X.pos,
        tri[(j + 1) % 3]["position"] as vec3,
        tri[j]["position"] as vec3
      );
      sub(
        Y.pos,
        tri[(j + 2) % 3]["position"] as vec3,
        tri[j]["position"] as vec3
      );

      sub2(X.uv, tri[(j + 1) % 3]["uv"] as vec2, tri[j]["uv"] as vec2);
      sub2(Y.uv, tri[(j + 2) % 3]["uv"] as vec2, tri[j]["uv"] as vec2);

      const invDet = 1.0 / (X.uv[0] * Y.uv[1] - X.uv[1] * Y.uv[0]);

      let t = glMatrix.vec3.create();
      let b = glMatrix.vec3.create();

      // tangent
      mult(t, X.pos, Y.uv[1]);
      mult(aux, Y.pos, -X.uv[1]);
      add(t, t, aux);
      mult(t, t, invDet);
      normalize(t, t);
      tb.push(...t);

      // bitangent
      mult(aux, X.pos, -Y.uv[0]);
      mult(b, Y.pos, X.uv[0]);
      add(b, b, aux);
      mult(b, b, invDet);
      normalize(b, b);

      // And put tangent & handedness
      const n = tri[j]["normal"] as vec3;
      cross(t, t, b);
      tb.push(sign(dot(t, n)));

      // Mark as processed
      processed.add(tri[j].index);
    }
  }

  mesh.vertexFormat.push({
    semantics: "tangent",
    size: 4,
    type: WebGL2RenderingContext.FLOAT,
    slot: slot,
    offset: mesh.vertexData.byteLength,
    stride: 32
  });

  mesh.vertexData = concatBuffers(mesh.vertexData, Float32Array.from(tb));

  console.log(tb);

  return mesh;
};

export const concatBuffers = (
  buffer1: ArrayBufferView,
  buffer2: ArrayBufferView
): ArrayBufferView => {
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(
    new Uint8Array(buffer1.buffer, buffer1.byteOffset, buffer1.byteLength),
    0
  );
  tmp.set(
    new Uint8Array(buffer2.buffer, buffer2.byteOffset, buffer2.byteLength),
    buffer1.byteLength
  );
  return tmp;
};
