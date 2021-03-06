import * as glMatrix from "gl-matrix";

import {
  Camera,
  Cubemap,
  Material,
  Geometry,
  Renderer,
  Texture2d,
  Drawable,
  Transform,
  RenderSettings
} from "./graphics";

import { KtxInfo, readKtx } from "./ktx-reader";
import { loadObj } from "./obj-loader";

import SKYBOX_VS from "./shaders/skybox.vs.glsl";
import SKYBOX_FS from "./shaders/skybox.fs.glsl";
import SUZANNE from "./objects/suzanne.obj";
import ICOSPHERE from "./objects/icosphere.obj";
import CUBE from "./objects/cube.obj";
import TV from "./objects/tv.obj";

import { calculateTangents } from "./mesh-utils";
import { resolveImage } from "./resolve-image";

export interface Scene {
  name: string;
  camera: Camera;
  skybox: Drawable;
  drawables: Drawable[];
  settings: RenderSettings;
}

const WHITE = new Uint8Array([255, 255, 255, 255]);
const FLAT = new Uint8Array([127, 127, 255, 255]);

const ENV1_IBL =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/sky/env1_ibl.ktx";
const ENV1_SKYBOX =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/sky/env1_skybox.ktx";
const ENV2_IBL =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/sky/env2_ibl.ktx";
const ENV2_SKYBOX =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/sky/env2_skybox.ktx";
const ENV3_IBL =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/sky/env3_ibl.ktx";
const ENV3_SKYBOX =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/sky/env3_skybox.ktx";

const TV_ALBEDO =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/textures/uv_albedo-rgb.jpg";
const TV_AO =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/textures/uv_AO-rgb.jpg";
const TV_METALIC =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/textures/uv_metallic-rgb.jpg";
const TV_NORMAL =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/textures/uv_normal-rgb.png";
const TV_ROUGHNESS =
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/textures/uv_roughness-rgb.jpg";

const lerp = (a: number, b: number, f: number) => (1 - f) * a + f * b;

const parseSH = (ktx: KtxInfo): number[] => {
  const meta = ktx.keyValueData.find(([key, value]) => /sh/.test(key));
  if (!meta) {
    return [];
  }
  const [, sh] = meta;
  return sh
    .split(/[\s]+/g)
    .map(parseFloat)
    .filter(v => !isNaN(v));
};

const createBallsScene = async (renderer: Renderer): Promise<Scene> => {
  const [ibl, skybox] = await Promise.all([
    fetch(ENV2_IBL).then(r => r.arrayBuffer()),
    fetch(ENV2_SKYBOX).then(r => r.arrayBuffer())
  ]);

  const iblKtx = readKtx(ibl);
  const skyboxKtx = readKtx(skybox);
  const iblCubemap = renderer.createCubeMap(iblKtx);
  const skyboxCubemap = renderer.createCubeMap(skyboxKtx);

  const sphereGeometry = renderer.createGeometry(
    calculateTangents(loadObj(ICOSPHERE)["Icosphere"])
  );

  const cubeGeometry = renderer.createGeometry(loadObj(CUBE)["Cube"]);

  const drawables: Drawable[] = [];
  {
    const dfgLut = renderer.createDfgTexture();
    const sphericalHarmonics = parseSH(iblKtx);
    const N = 8;
    const RANGE = 10.0;
    const matAlbedo = [1.0, 0.0, 0.0].map(v => Math.pow(v, 1.0 / 2.2));
    const matReflectance = 0.6;
    const scale = 0.06;
    const white = renderer.createTextureFromBytes(
      WHITE,
      1,
      1,
      WebGL2RenderingContext.RGBA8,
      WebGL2RenderingContext.RGBA,
      WebGL2RenderingContext.UNSIGNED_BYTE
    );
    const flat = renderer.createTextureFromBytes(
      FLAT,
      1,
      1,
      WebGL2RenderingContext.RGBA8,
      WebGL2RenderingContext.RGBA,
      WebGL2RenderingContext.UNSIGNED_BYTE
    );

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const transform = new Transform();
        transform.position = [
          lerp(-RANGE * 0.5, RANGE * 0.5, j / N),
          lerp(-RANGE * 0.5, RANGE * 0.5, i / N),
          0.0
        ];

        transform.scale = [scale, scale, scale];
        const material = {
          cubemaps: { prefilteredEnvMap: iblCubemap },
          textures: {
            dfgLut,
            matAlbedoMap: white,
            matAoMap: white,
            matMetallicMap: white,
            matNormalMap: flat,
            matRouhnessMap: white
          },
          uniforms: {
            sphericalHarmonics,
            matAlbedo,
            matMetallic: j / (N - 1),
            matReflectance,
            matRoughness: i / (N - 1)
          }
        };

        drawables.push({ material, transform, geometry: sphereGeometry });
      }
    }
  }

  const skyboxMaterial = {
    shader: renderer.createShader(SKYBOX_VS, SKYBOX_FS),
    cubemaps: { env: skyboxCubemap },
    state: { cullFace: WebGL2RenderingContext.FRONT, zWrite: false }
  };

  const camera = new Camera(
    45.0,
    renderer.context.canvas.width / renderer.context.canvas.height,
    0.01,
    100.0
  );
  camera.position = [0.0, 0.0, 5.0];

  return {
    name: "Balls",
    camera,
    settings: {
      gamma: 2.2,
      exposure: 3.0
    },
    skybox: {
      material: skyboxMaterial,
      geometry: cubeGeometry,
      transform: new Transform()
    },
    drawables
  };
};

const createTvScene = async (renderer: Renderer): Promise<Scene> => {
  const [
    ibl,
    skybox,
    tvAlbedoImg,
    tvAoImg,
    tvMetalicImg,
    tvNormalImg,
    tvRoughnessImg
  ] = await Promise.all([
    fetch(ENV1_IBL).then(r => r.arrayBuffer()),
    fetch(ENV1_SKYBOX).then(r => r.arrayBuffer()),
    resolveImage(TV_ALBEDO),
    resolveImage(TV_AO),
    resolveImage(TV_METALIC),
    resolveImage(TV_NORMAL),
    resolveImage(TV_ROUGHNESS)
  ]);

  const iblKtx = readKtx(ibl as ArrayBuffer);
  const skyboxKtx = readKtx(skybox as ArrayBuffer);
  const iblCubemap = renderer.createCubeMap(iblKtx);
  const skyboxCubemap = renderer.createCubeMap(skyboxKtx);

  const dfgLut = renderer.createDfgTexture();
  const sphericalHarmonics = parseSH(iblKtx);

  const scale = 0.075;

  const material = {
    cubemaps: { prefilteredEnvMap: iblCubemap },
    textures: {
      dfgLut,
      matAlbedoMap: renderer.createTextureFromImage(
        tvAlbedoImg as HTMLImageElement,
        WebGL2RenderingContext.RGB8,
        WebGL2RenderingContext.RGB,
        WebGL2RenderingContext.UNSIGNED_BYTE
      ),
      matAoMap: renderer.createTextureFromImage(
        tvAoImg as HTMLImageElement,
        WebGL2RenderingContext.RGB8,
        WebGL2RenderingContext.RGB,
        WebGL2RenderingContext.UNSIGNED_BYTE
      ),
      matMetallicMap: renderer.createTextureFromImage(
        tvMetalicImg as HTMLImageElement,
        WebGL2RenderingContext.RGB8,
        WebGL2RenderingContext.RGB,
        WebGL2RenderingContext.UNSIGNED_BYTE
      ),
      matNormalMap: renderer.createTextureFromImage(
        tvNormalImg as HTMLImageElement,
        WebGL2RenderingContext.RGB8,
        WebGL2RenderingContext.RGB,
        WebGL2RenderingContext.UNSIGNED_BYTE
      ),
      matRouhnessMap: renderer.createTextureFromImage(
        tvRoughnessImg as HTMLImageElement,
        WebGL2RenderingContext.RGB8,
        WebGL2RenderingContext.RGB,
        WebGL2RenderingContext.UNSIGNED_BYTE
      )
    },
    uniforms: {
      sphericalHarmonics,
      matAlbedo: [1.0, 1.0, 1.0],
      matMetallic: 1.0,
      matReflectance: 0.5,
      matRoughness: 1.5
    }
  };

  const drawables: Drawable[] = [];
  const tv = loadObj(TV);
  for (const name in tv) {
    const transform = new Transform();
    transform.scale = [scale, scale, scale];
    transform.position = [0.0, -2.0, 0.0];
    const geometry = renderer.createGeometry(calculateTangents(tv[name]));
    drawables.push({ material, transform, geometry });
  }

  const cubeGeometry = renderer.createGeometry(loadObj(CUBE)["Cube"]);

  const skyboxMaterial = {
    shader: renderer.createShader(SKYBOX_VS, SKYBOX_FS),
    cubemaps: { env: skyboxCubemap },
    state: { cullFace: WebGL2RenderingContext.FRONT, zWrite: false }
  };

  const camera = new Camera(
    45.0,
    renderer.context.canvas.width / renderer.context.canvas.height,
    0.01,
    100.0
  );
  camera.position = [0.0, 0.0, 5.0];

  return {
    name: "Tv",
    camera,
    settings: {
      gamma: 2.2,
      exposure: 8.0
    },
    skybox: {
      material: skyboxMaterial,
      geometry: cubeGeometry,
      transform: new Transform()
    },
    drawables
  };
};

export default async (renderer: Renderer): Promise<Scene[]> => {
  return Promise.all([createBallsScene(renderer), createTvScene(renderer)]);
};
