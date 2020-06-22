import "./style.css";
import { vec3 } from "gl-matrix";

import { Renderer } from "./graphics";

import init from "./scenes";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;
const floor = Math.floor;
const origin: vec3 = [0.0, 0.0, 0.0];

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
const renderer = new Renderer(gl);

init(renderer).then(scenes => {
  const scene = scenes[0];

  let t = Date.now(),
    dt = 0.0,
    angle = 0.0;
  const omega = Math.PI * 0.025,
    radius = 5.0;

  const draw = () => {
    angle += omega * dt;
    const pos: vec3 = [
      radius * cos(angle),
      radius * sin(angle * 0.05) * cos(angle * 0.05),
      radius * sin(angle)
    ];
    scene.camera.lookAt(pos, origin);

    renderer.clear();
    for (const drawable of scene.drawables) {
      renderer.drawGeometry(scene.camera, drawable, drawable.material);
    }

    requestAnimationFrame(draw);

    dt = (Date.now() - t) * 1.0e-3;
    t = Date.now();
  };
  draw();
});
