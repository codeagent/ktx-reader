import * as glMatrix from "gl-matrix";
import { quat, mat4, vec3 } from "gl-matrix";

import { KtxInfo } from "./ktx-reader";

export type Shader = WebGLProgram;
export type Cubemap = WebGLTexture;
export type VertexBuffer = WebGLBuffer;
export type IndexBuffer = WebGLBuffer;

export interface Material {
  shader: Shader;
  cubemaps: {
    [name: string]: Cubemap;
  };
  state: {
    cullFace: GLenum;
    zWrite: boolean;
  };
}

export interface VertexAttribute {
  slot: number;
  size: number;
  type: GLenum;
  offset: number;
  stride: number;
}

export interface Geometry {
  vao: WebGLVertexArrayObject;
  length: number;
}

export interface Mesh {
  vertexFormat: VertexAttribute[];
  vertexData: ArrayBufferView;
  indexData: Uint16Array;
}

export class Renderer {
  constructor(private _gl: WebGL2RenderingContext) {
    _gl.clearColor(0.0, 0.0, 0.0, 1.0);
    _gl.clearDepth(1.0);
    _gl.enable(_gl.DEPTH_TEST);
    _gl.enable(_gl.CULL_FACE);
    _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, 4);
    _gl.depthFunc(_gl.LEQUAL);
    _gl.viewport(0, 0, _gl.canvas.width, _gl.canvas.height);
  }

  clear() {
    this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
  }

  createGeometry(mesh: Mesh): Geometry {
    const vBuffer = this.createVertexBuffer(mesh.vertexData);
    const iBuffer = this.createIndexBuffer(mesh.indexData);

    const vao = this._gl.createVertexArray();
    this._gl.bindVertexArray(vao);
    for (const attribute of mesh.vertexFormat) {
      this._gl.enableVertexAttribArray(attribute.slot);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, vBuffer);
      if (attribute.type === WebGL2RenderingContext.FLOAT) {
        this._gl.vertexAttribPointer(
          attribute.slot,
          attribute.size,
          attribute.type,
          false,
          attribute.stride,
          attribute.offset
        );
      } else {
        this._gl.vertexAttribIPointer(
          attribute.slot,
          attribute.size,
          attribute.type,
          attribute.stride,
          attribute.offset
        );
      }
    }
    this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    return { vao, length: mesh.indexData.length };
  }

  createShader(vs: string, fs: string) {
    const gl = this._gl;
    const program = gl.createProgram();
    let shaders = [];
    try {
      for (const shader of [
        { type: WebGL2RenderingContext.VERTEX_SHADER, sourceCode: vs },
        { type: WebGL2RenderingContext.FRAGMENT_SHADER, sourceCode: fs }
      ]) {
        const shaderObject = gl.createShader(shader.type);
        gl.shaderSource(shaderObject, shader.sourceCode);
        gl.compileShader(shaderObject);
        if (!gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS)) {
          throw new Error(
            `${
              shader.type === WebGL2RenderingContext.VERTEX_SHADER
                ? "Vertex"
                : "Fragment"
            } shader compile error: '${gl.getShaderInfoLog(shaderObject)}' \n${
              shader.sourceCode
            }\n`
          );
        }
        gl.attachShader(program, shaderObject);
        shaders.push(shaderObject);
      }

      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
          `Unable to initialize the shader program: '${gl.getProgramInfoLog(
            program
          )}'`
        );
      }
    } catch (e) {
      shaders.forEach(shader => gl.deleteShader(shader));
      gl.deleteProgram(program);
      throw e;
    }

    return program;
  }

  createCubeMap(ktx: KtxInfo): Cubemap {
    const gl = this._gl;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    let level = 0;
    for (let mip of ktx.mipmaps) {
      const faces = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, bytes: mip.cubemap[0] },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, bytes: mip.cubemap[1] },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, bytes: mip.cubemap[2] },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, bytes: mip.cubemap[3] },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, bytes: mip.cubemap[4] },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, bytes: mip.cubemap[5] }
      ];

      for (const face of faces) {
        gl.texImage2D(
          face.target,
          level,
          ktx.glInternalFormat,
          mip.width,
          mip.height,
          0,
          ktx.glInternalFormat === WebGL2RenderingContext.R11F_G11F_B10F
            ? WebGL2RenderingContext.RGB
            : ktx.glFormat,
          ktx.glInternalFormat === WebGL2RenderingContext.R11F_G11F_B10F
            ? WebGL2RenderingContext.UNSIGNED_INT_10F_11F_11F_REV
            : ktx.glType,
          ktx.glInternalFormat === WebGL2RenderingContext.R11F_G11F_B10F
            ? new Uint32Array(
                face.bytes.buffer,
                face.bytes.byteOffset,
                face.bytes.byteLength / 4
              )
            : face.bytes
        );
      }

      level++;
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  drawGeometry(camera: Camera, geometry: Geometry, material: Material) {
    this._gl.useProgram(material.shader);
    let unit = 0;
    let loc;
    for (const name in material.cubemaps) {
      loc = this._gl.getUniformLocation(material.shader, name);
      this._gl.activeTexture(this._gl.TEXTURE0 + unit);
      this._gl.bindTexture(this._gl.TEXTURE_CUBE_MAP, material.cubemaps[name]);
      this._gl.uniform1i(loc, unit);
      unit++;
    }

    loc = this._gl.getUniformLocation(material.shader, "viewMat");
    this._gl.uniformMatrix4fv(loc, false, camera.view);

    loc = this._gl.getUniformLocation(material.shader, "projMat");
    this._gl.uniformMatrix4fv(loc, false, camera.projection);

    loc = this._gl.getUniformLocation(material.shader, "pos");
    this._gl.uniform3fv(loc, camera.position);

    if (material.state) {
      this._gl.cullFace(material.state.cullFace || WebGL2RenderingContext.BACK);
      this._gl.depthMask(material.state.zWrite || true);
    } else {
      this._gl.cullFace(WebGL2RenderingContext.BACK);
      this._gl.depthMask(true);
    }

    this._gl.bindVertexArray(geometry.vao);
    this._gl.drawElements(
      WebGL2RenderingContext.TRIANGLES,
      geometry.length,
      WebGL2RenderingContext.UNSIGNED_SHORT,
      0
    );
  }

  private createVertexBuffer(data: ArrayBufferView): VertexBuffer {
    const vbo = this._gl.createBuffer();
    this._gl.bindBuffer(this._gl.ARRAY_BUFFER, vbo);
    this._gl.bufferData(this._gl.ARRAY_BUFFER, data, this._gl.STATIC_DRAW);
    this._gl.bindBuffer(this._gl.ARRAY_BUFFER, null);
    return vbo;
  }

  private createIndexBuffer(data: ArrayBufferView): IndexBuffer {
    const ebo = this._gl.createBuffer();
    this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, ebo);
    this._gl.bufferData(
      this._gl.ELEMENT_ARRAY_BUFFER,
      data,
      this._gl.STATIC_DRAW
    );
    this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, null);
    return ebo;
  }
}

export class Camera {
  set rotation(rotation: quat) {
    this._rotation = rotation;
    this._dirty = true;
  }

  get rotation() {
    return this._rotation;
  }

  set position(position: vec3) {
    this._position = position;
    this._dirty = true;
  }

  get position() {
    return this._position;
  }

  get view() {
    if (this._dirty) {
      glMatrix.mat4.fromRotationTranslation(
        this._view,
        this._rotation,
        this._position
      );
      glMatrix.mat4.invert(this._view, this._view);
      this._dirty = true;
    }
    return this._view;
  }

  get projection() {
    return this._projection;
  }

  protected _view: mat4 = glMatrix.mat4.create();
  protected _projection: mat4 = glMatrix.mat4.create();
  protected _position: vec3 = glMatrix.vec3.create();
  protected _rotation: quat = glMatrix.quat.create();
  private _dirty = true;

  constructor(
    public readonly fov,
    public readonly aspect,
    public readonly near,
    public readonly far
  ) {
    glMatrix.mat4.perspective(
      this._projection,
      glMatrix.glMatrix.toRadian(this.fov),
      this.aspect,
      this.near,
      this.far
    );
  }

  lookAt(eye: vec3, at: vec3) {
    glMatrix.mat4.targetTo(this._view, eye, at, [0.0, 1.0, 0.0]);
    glMatrix.mat4.getTranslation(this._position, this._view);
    glMatrix.mat4.getRotation(this._rotation, this._view);
    glMatrix.mat4.invert(this._view, this._view);
  }
}

export const createCube = (): Mesh => {
  return {
    vertexFormat: [
      {
        size: 3,
        type: WebGL2RenderingContext.FLOAT,
        slot: 0,
        offset: 0,
        stride: 24
      },
      {
        size: 3,
        type: WebGL2RenderingContext.FLOAT,
        slot: 1,
        offset: 12,
        stride: 24
      }
    ],
    vertexData: Float32Array.from([
      1,
      -1,
      -1,
      0,
      0,
      -1,
      -1,
      1,
      -1,
      0,
      0,
      -1,
      1,
      1,
      -1,
      0,
      0,
      -1,
      -1,
      1,
      1,
      0,
      0,
      1,
      1,
      -1,
      1,
      0,
      0,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      -1,
      -1,
      1,
      0,
      0,
      1,
      1,
      -1,
      1,
      0,
      0,
      1,
      -1,
      1,
      0,
      -1,
      0,
      -1,
      -1,
      -1,
      0,
      -1,
      0,
      1,
      -1,
      -1,
      0,
      -1,
      0,
      -1,
      -1,
      -1,
      -1,
      0,
      0,
      -1,
      1,
      1,
      -1,
      0,
      0,
      -1,
      1,
      -1,
      -1,
      0,
      0,
      1,
      1,
      -1,
      0,
      1,
      0,
      -1,
      1,
      1,
      0,
      1,
      0,
      1,
      1,
      1,
      0,
      1,
      0,
      -1,
      -1,
      -1,
      0,
      0,
      -1,
      -1,
      -1,
      1,
      0,
      0,
      1,
      1,
      -1,
      1,
      1,
      0,
      0,
      -1,
      -1,
      1,
      0,
      -1,
      0,
      -1,
      -1,
      1,
      -1,
      0,
      0,
      -1,
      1,
      -1,
      0,
      1,
      0
    ]),
    indexData: Uint16Array.from([
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      0,
      18,
      1,
      3,
      19,
      4,
      6,
      20,
      7,
      9,
      21,
      10,
      12,
      22,
      13,
      15,
      23,
      16
    ])
  };
};
