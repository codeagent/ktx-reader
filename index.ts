import "./style.css";

import { readKtx } from "./ktx-reader";

const cube: Geometry;
const camera: Camera;

const skyboxMaterial = {
  shader: Shader,
  background: Texture
};

const mirrorMaterial = {
  shader: Shader,
  env: Texture
};

const draw = () => {
  renderer.clear();
  renderer.drawGeometry(camera, cube, skyboxMaterial);
  renderer.drawCube(camera, cube, mirrorMaterial);

  requestAnimationFrame(draw);
};

fetch(
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/pillars_2k_ibl.ktx"
)
  .then(r => r.arrayBuffer())
  .then(b => {
    const info = readKtx(b);
    // console.log(info);
  });
