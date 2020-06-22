import {
  Camera,
  Cubemap,
  Material,
  Geometry,
  Renderer,
  Texture2d,
  Drawable,
  Transform
} from "./graphics";

import { KtxInfo, readKtx } from "./ktx-reader";
import { loadObj } from "./obj-loader";

import PBR_VS from "./shaders/pbr.vs.glsl";
import PBR_FS from "./shaders/pbr.fs.glsl";
import SKYBOX_VS from "./shaders/skybox.vs.glsl";
import SKYBOX_FS from "./shaders/skybox.fs.glsl";
import SUZANNE from "./objects/suzanne.obj";
import ICOSPHERE from "./objects/icosphere.obj";
import CUBE from "./objects/cube.obj";
import TV from "./objects/tv.obj";

export interface Scene {
  name: string;
  camera: Camera;
  drawables: Drawable[];
}

const lerp = (a: number, b: number, f: number) => (1 - f) * a + f * b;

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

// Simple sphere scene
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
    loadObj(ICOSPHERE)["Icosphere"]
  );

  const cubeGeometry = renderer.createGeometry(loadObj(CUBE)["Cube"]);

  const drawables: Drawable[] = [];
  {
    const pbrShader = renderer.createShader(PBR_VS, PBR_FS);
    const dfgLut = renderer.createDfgTexture();
    const sphericalHarmonics = parseSH(iblKtx);
    const N = 8;
    const RANGE = 10.0;
    const matAlbedo = [1.0, 0.0, 0.0].map(v => Math.pow(v, 1.0 / 2.2));
    const matReflectance = 0.6;
    const scale = 0.6;

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
          shader: pbrShader,
          cubemaps: { prefilteredEnvMap: iblCubemap },
          textures: { dfgLut },
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
    drawables: [
      ...drawables,
      {
        material: skyboxMaterial,
        geometry: cubeGeometry,
        transform: new Transform()
      }
    ]
  };
};

const createTvScene = async (renderer: Renderer): Promise<Scene> => {
  const [ibl, skybox] = await Promise.all([
    fetch(ENV2_IBL).then(r => r.arrayBuffer()),
    fetch(ENV2_SKYBOX).then(r => r.arrayBuffer())
  ]);

  const iblKtx = readKtx(ibl);
  const skyboxKtx = readKtx(skybox);
  const iblCubemap = renderer.createCubeMap(iblKtx);
  const skyboxCubemap = renderer.createCubeMap(skyboxKtx);

  const pbrShader = renderer.createShader(PBR_VS, PBR_FS);
  const dfgLut = renderer.createDfgTexture();
  const sphericalHarmonics = parseSH(iblKtx);

  const scale = 0.075;

  const material = {
    shader: pbrShader,
    cubemaps: { prefilteredEnvMap: iblCubemap },
    textures: { dfgLut },
    uniforms: {
      sphericalHarmonics,
      matAlbedo: [1.0, 0.0, 0.0].map(v => Math.pow(v, 1.0 / 2.2)),
      matMetallic: 0.1,
      matReflectance: 0.2,
      matRoughness: 0.6
    }
  };

  const drawables: Drawable[] = [];
  const tv = loadObj(TV);
  for (const name in tv) {
    const transform = new Transform();
    transform.scale = [scale, scale, scale];
    transform.position = [0.0, -3.0, 0.0];
    const geometry = renderer.createGeometry(tv[name]);
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
    drawables: [
      ...drawables,
      {
        material: skyboxMaterial,
        geometry: cubeGeometry,
        transform: new Transform()
      }
    ]
  };
};

export default async (renderer: Renderer): Promise<Scene[]> => {
  return Promise.all([createBallsScene(renderer), createTvScene(renderer)]);
};
