import * as glMatrix from "gl-matrix";
import { quat, mat4, vec3 } from "gl-matrix";

import { KtxInfo } from "./ktx-reader";

import DFG from "./dfg";

export type Shader = WebGLProgram;
export type Cubemap = WebGLTexture;
export type Texture2d = WebGLTexture;
export type VertexBuffer = WebGLBuffer;
export type IndexBuffer = WebGLBuffer;

export interface Material {
  shader: Shader;
  cubemaps?: {
    [name: string]: Cubemap;
  };
  textures?: {
    [name: string]: Texture2d;
  };
  uniforms?: {
    [name: string]: Float32Array | number[] | number;
  };
  state?: {
    cullFace: GLenum;
    zWrite: boolean;
  };
}

export interface VertexAttribute {
  semantics: string;
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

export interface RenderSettings {
  exposure: number;
  gamma: number;
}

export interface Drawable {
  material: Material;
  geometry: Geometry;
  transform: Transform;
}

export class Renderer {
  get context() {
    return this._gl;
  }
  private _renderSettings: RenderSettings;

  constructor(private _gl: WebGL2RenderingContext) {
    _gl.clearColor(0.0, 0.0, 0.0, 1.0);
    _gl.clearDepth(1.0);
    _gl.enable(_gl.DEPTH_TEST);
    _gl.enable(_gl.CULL_FACE);
    _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, 4);
    _gl.depthFunc(_gl.LEQUAL);
    _gl.viewport(0, 0, _gl.canvas.width, _gl.canvas.height);

    this._renderSettings = {
      exposure: 1.0,
      gamma: 2.2
    };
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
    this._gl.bindVertexArray(null);
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
    gl.texParameteri(
      gl.TEXTURE_CUBE_MAP,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(
      gl.TEXTURE_CUBE_MAP,
      gl.TEXTURE_MAX_LEVEL,
      ktx.numberOfMipmapLevels - 1
    );
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  createDfgTexture() {
    const gl = this._gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      WebGL2RenderingContext.RG16F,
      128,
      128,
      0,
      WebGL2RenderingContext.RG,
      WebGL2RenderingContext.HALF_FLOAT,
      Uint16Array.from(DFG)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  createTextureFromImage(
    image: HTMLImageElement,
    internalFormat: GLenum,
    format: GLenum,
    type: GLenum
  ) {
    const gl = this._gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      image.width,
      image.height,
      0,
      format,
      type,
      image
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.generateMipmap(gl.TEXTURE_2D);

    return texture;
  }

  createTextureFromBytes(
    bytes: ArrayBufferView,
    width: number,
    height: number,
    internalFormat: GLenum,
    format: GLenum,
    type: GLenum
  ) {
    const gl = this._gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      width,
      height,
      0,
      format,
      type,
      bytes
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.generateMipmap(gl.TEXTURE_2D);

    return texture;
  }

  drawGeometry(camera: Camera, drawable: Drawable, material: Material) {
    this._gl.useProgram(material.shader);
    let unit = 0;
    let loc;

    // Material textures
    for (const name in material.textures) {
      loc = this._gl.getUniformLocation(material.shader, name);
      if (loc) {
        this._gl.activeTexture(this._gl.TEXTURE0 + unit);
        this._gl.bindTexture(this._gl.TEXTURE_2D, material.textures[name]);
        this._gl.uniform1i(loc, unit);
        unit++;
      }
    }

    // Material cubemaps
    for (const name in material.cubemaps) {
      loc = this._gl.getUniformLocation(material.shader, name);
      if (loc) {
        this._gl.activeTexture(this._gl.TEXTURE0 + unit);
        this._gl.bindTexture(
          this._gl.TEXTURE_CUBE_MAP,
          material.cubemaps[name]
        );
        this._gl.uniform1i(loc, unit);
        unit++;
      }
    }

    // Material uniforms
    const uniforms = { ...this._renderSettings, ...material.uniforms };
    for (const name in uniforms) {
      loc = this._gl.getUniformLocation(material.shader, name);
      if (typeof uniforms[name] === "number") {
        this._gl.uniform1f(loc, uniforms[name] as number);
      } else {
        this._gl.uniform3fv(loc, uniforms[name] as number[]);
      }
    }

    loc = this._gl.getUniformLocation(material.shader, "worldMat");
    if (loc) {
      this._gl.uniformMatrix4fv(loc, false, drawable.transform.transform);
    }

    loc = this._gl.getUniformLocation(material.shader, "viewMat");
    if (loc) {
      this._gl.uniformMatrix4fv(loc, false, camera.view);
    }

    loc = this._gl.getUniformLocation(material.shader, "projMat");
    if (loc) {
      this._gl.uniformMatrix4fv(loc, false, camera.projection);
    }

    loc = this._gl.getUniformLocation(material.shader, "pos");
    if (loc) {
      this._gl.uniform3fv(loc, camera.position);
    }

    if (material.state) {
      this._gl.cullFace(material.state.cullFace || WebGL2RenderingContext.BACK);
      this._gl.depthMask(material.state.zWrite || true);
    } else {
      this._gl.cullFace(WebGL2RenderingContext.BACK);
      this._gl.depthMask(true);
    }

    this._gl.bindVertexArray(drawable.geometry.vao);
    this._gl.drawElements(
      WebGL2RenderingContext.TRIANGLES,
      drawable.geometry.length,
      WebGL2RenderingContext.UNSIGNED_SHORT,
      0
    );
  }

  setRenderSettings(settigs: RenderSettings) {
    this._renderSettings = settigs;
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

export class Transform {
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

  set scale(scale: vec3) {
    this._scale = scale;
    this._dirty = true;
  }

  get scale() {
    return this._scale;
  }

  get transform() {
    if (this._dirty) {
      glMatrix.mat4.fromRotationTranslationScale(
        this._transform,
        this._rotation,
        this._position,
        this._scale
      );
      this._dirty = true;
    }
    return this._transform;
  }

  protected _transform: mat4 = glMatrix.mat4.create();
  protected _dirty = true;

  constructor(
    protected _position: vec3 = glMatrix.vec3.create(),
    protected _scale: vec3 = glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
    protected _rotation: quat = glMatrix.quat.create()
  ) {}
}

export class Camera extends Transform {
  get view() {
    glMatrix.mat4.invert(this._view, this.transform);
    return this._view;
  }

  get projection() {
    return this._projection;
  }

  protected _view: mat4 = glMatrix.mat4.create();
  protected _projection: mat4 = glMatrix.mat4.create();

  constructor(
    public readonly fov,
    public readonly aspect,
    public readonly near,
    public readonly far
  ) {
    super();
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
    glMatrix.mat4.getTranslation(this.position, this._view);
    glMatrix.mat4.getRotation(this.rotation, this._view);
  }
}
