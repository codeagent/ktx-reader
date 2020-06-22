import {
  Camera,
  Cubemap,
  Material,
  Geometry,
  Renderer,
  Texture2d
} from "./graphics";

import { KtxInfo, readKtx } from "./ktx-reader";
import { loadObj } from "./obj-loader";

import PBR_VS from "./shaders/mirror.vs.glsl";
import PBR_FS from "./shaders/mirror.fs.glsl";
import SKYBOX_VS from "./shaders/skybox.vs.glsl";
import SKYBOX_FS from "./shaders/skybox.fs.glsl";
import SUZANNE from "./objects/suzanne.obj";
import ICOSPHERE from "./objects/icosphere.obj";
import CUBE from "./objects/cube.obj";

export interface Drawable {
  material: Material;
  geometry: Geometry;
}

export interface Scene {
  name: string;
  camera: Camera;
  drawables: Drawable[];
}

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
  const [sh] = meta;
  return sh
    .split(/[\s]+/g)
    .map(parseFloat)
    .filter(v => !isNaN(v));
};

// Simple sphere scene
const createBallScene = async (renderer: Renderer): Promise<Scene> => {
  const [ibl, skybox] = await Promise.all([
    fetch(ENV1_IBL).then(r => r.arrayBuffer()),
    fetch(ENV1_SKYBOX).then(r => r.arrayBuffer())
  ]);

  const iblKtx = readKtx(ibl);
  const skyboxKtx = readKtx(skybox);
  const iblCubemap = renderer.createCubeMap(iblKtx);
  const skyboxCubemap = renderer.createCubeMap(skyboxKtx);

  const pbrMaterial = {
    shader: renderer.createShader(PBR_VS, PBR_FS),
    cubemaps: { prefilteredEnvMap: iblCubemap },
    textures: { dfgLut: renderer.createDfgTexture() },
    uniforms: { sphericalHarmonics: parseSH(iblKtx) }
  };

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

  const sphereGeometry = renderer.createGeometry(
    loadObj(ICOSPHERE)["Icosphere"]
  );

  const cubeGeometry = renderer.createGeometry(loadObj(CUBE)["Cube"]);

  return {
    name: "Ball",
    camera,
    drawables: [
      { material: pbrMaterial, geometry: sphereGeometry },
      { material: skyboxMaterial, geometry: cubeGeometry }
    ]
  };
};

export default async (renderer: Renderer): Promise<Scene[]> => {
  return Promise.all([createBallScene(renderer)]);
};
