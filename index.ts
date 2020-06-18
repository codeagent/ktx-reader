import "./style.css";
import { vec3 } from "gl-matrix";

import { readKtx } from "./ktx-reader";
import { Renderer, createCube, Camera } from "./graphics";
import MIRROR_VS from "./shaders/mirror.vs.glsl";
import MIRROR_FS from "./shaders/mirror.fs.glsl";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;
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
    const cubemapInfo = readKtx(b);
    const cubemap = renderer.createCubeMap(cubemapInfo);
    const mirrorMaterial = {
      shader: renderer.createShader(MIRROR_VS, MIRROR_FS),
      cubemaps: {
        env: renderer.createCubeMap(cubemapInfo)
      }
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
      const pos = [radius * cos(angle), 2.0, radius * sin(angle)];
      camera.lookAt(pos, origin);

      renderer.clear();
      renderer.drawGeometry(camera, cubeGeometry, mirrorMaterial);
      requestAnimationFrame(draw);

      dt = (Date.now() - t) * 1.0e-3;
      t = Date.now();
    };
    draw();
  });
