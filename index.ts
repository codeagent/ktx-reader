import "./style.css";
import { vec3 } from "gl-matrix";

import { Renderer } from "./graphics";
import { SceneOptionsForm, RenderMode } from "./controls";
import init from "./scenes";

import VS from "./shaders/pbr.vs.glsl";
import PBR_FS from "./shaders/pbr.fs.glsl";
import MATCAP_FS from "./shaders/matcap.fs.glsl";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;
const floor = Math.floor;
const origin: vec3 = [0.0, 0.0, 0.0];

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
const renderer = new Renderer(gl);

init(renderer).then(scenes => {
  const materialShader = renderer.createShader(VS, PBR_FS);
  const matcapShader = renderer.createShader(VS, MATCAP_FS);

  const shaderLookup = {
    [RenderMode.Material]: materialShader,
    [RenderMode.Matcap]: matcapShader
  };
  let scene = scenes[1];
  let shader = shaderLookup[RenderMode.Material];

  const sceneOptionsForm = new SceneOptionsForm(
    {
      scene: scene.name,
      gamma: scene.settings.gamma,
      exposure: scene.settings.exposure,
      renderMode: RenderMode.Material
    },
    scenes.map(s => s.name),
    document.getElementById("form")
  );

  sceneOptionsForm.change$.subscribe(options => {
    renderer.setRenderSettings({
      gamma: options.gamma,
      exposure: options.exposure
    });

    shader = shaderLookup[options.renderMode];

    if (scene.name !== options.scene) {
      scene = scenes.find(scene => scene.name === options.scene);
      renderer.setRenderSettings(scene.settings);
      sceneOptionsForm.value = {
        scene: scene.name,
        exposure: scene.settings.exposure,
        gamma: scene.settings.gamma,
        renderMode: options.renderMode
      };
    }
  });

  let t = Date.now(),
    dt = 0.0,
    angle = 0.0;
  const omega = Math.PI * 0.075,
    radius = 8.0;

  const draw = () => {
    angle += omega * dt;
    const pos: vec3 = [
      radius * sin(angle),
      radius * sin(angle * 0.25) * cos(angle * 0.25),
      radius * cos(angle)
    ];
    scene.camera.lookAt(pos, origin);

    renderer.clear();

    for (const drawable of scene.drawables) {
      drawable.material.shader = shader;
      renderer.drawGeometry(scene.camera, drawable);
    }

    renderer.drawGeometry(scene.camera, scene.skybox);

    requestAnimationFrame(draw);

    dt = (Date.now() - t) * 1.0e-3;
    t = Date.now();
  };
  draw();
});
