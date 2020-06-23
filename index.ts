import "./style.css";
import { vec3 } from "gl-matrix";

import { Renderer } from "./graphics";
import { SceneOptionsForm } from "./controls";

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
  let scene = scenes[0];

  const sceneOptionsForm = new SceneOptionsForm(
    {
      scene: scene.name,
      gamma: 2.2,
      exposure: 2.2
    },
    scenes.map(s => s.name),
    document.getElementById("form")
  );

  sceneOptionsForm.change$.subscribe(options => {
    renderer.setRenderSettings({
      gamma: options.gamma,
      exposure: options.exposure
    });

    if (scene.name !== options.scene) {
      scene = scenes.find(scene => scene.name === options.scene);
    }
  });

  let t = Date.now(),
    dt = 0.0,
    angle = 0.0;
  const omega = Math.PI * 0.025,
    radius = 8.0;

  const draw = () => {
    angle += omega * dt;
    const pos: vec3 = [
      radius * sin(angle),
      radius * sin(angle * 0.5) * cos(angle * 0.5),
      radius * cos(angle)
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
