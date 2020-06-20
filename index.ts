import "./style.css";
import { vec3 } from "gl-matrix";

import { readKtx } from "./ktx-reader";
import { Renderer, createCube, Camera } from "./graphics";
import { loadObj } from "./obj-loader";

import MIRROR_VS from "./shaders/mirror.vs.glsl";
import MIRROR_FS from "./shaders/mirror.fs.glsl";
import SKYBOX_VS from "./shaders/skybox.vs.glsl";
import SKYBOX_FS from "./shaders/skybox.fs.glsl";
import SUZANNE from "./objects/suzanne.obj";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;
const floor = Math.floor;
const origin: vec3 = [0.0, 0.0, 0.0];

fetch(
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/pillars_2k_ibl.ktx"
)
  .then(r => r.arrayBuffer())
  .then(b => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;

    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    const renderer = new Renderer(gl);
    const cubeGeometry = renderer.createGeometry(createCube());
    const monkeyGeometry = renderer.createGeometry(loadObj(SUZANNE)["Suzanne"]);

    const cubemapInfo = readKtx(b);
    const env = renderer.createCubeMap(cubemapInfo);
    const mirrorMaterial = {
      shader: renderer.createShader(MIRROR_VS, MIRROR_FS),
      cubemaps: { env }
    };

    const meta = cubemapInfo.keyValueData.find(([key, value]) =>
      /sh/.test(key)
    );
    const sphericalHarmonics = meta[1]
      .split(/[\s]+/g)
      .map(parseFloat)
      .filter(v => !isNaN(v));

    const pbrMaterial = {
      shader: renderer.createShader(MIRROR_VS, MIRROR_FS),
      cubemaps: { env },
      uniforms: { sphericalHarmonics }
    };

    const skyboxMaterial = {
      shader: renderer.createShader(SKYBOX_VS, SKYBOX_FS),
      cubemaps: { env },
      state: { cullFace: WebGL2RenderingContext.FRONT, zWrite: false }
    };
    const camera = new Camera(45.0, canvas.width / canvas.height, 0.01, 100.0);
    camera.position = [0.0, 0.0, 5.0];

    let t = Date.now(),
      dt = 0.0,
      angle = 0.0;
    const omega = Math.PI * 0.25,
      radius = 5.0;

    const draw = () => {
      angle += omega * dt;
      const pos: vec3 = [
        radius * cos(angle),
        radius * sin(angle * 0.5) * cos(angle * 0.5),
        radius * sin(angle)
      ];
      camera.lookAt(pos, origin);

      renderer.clear();
      renderer.drawGeometry(camera, cubeGeometry, skyboxMaterial);
      renderer.drawGeometry(camera, monkeyGeometry, pbrMaterial);

      requestAnimationFrame(draw);

      dt = (Date.now() - t) * 1.0e-3;
      t = Date.now();
    };
    draw();
  });
