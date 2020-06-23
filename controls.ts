import { Observable, BehaviorSubject, fromEvent, merge } from "rxjs";
import { map } from "rxjs/operators";

export enum RenderMode {
  Material = "Material",
  Matcap = "Matcap",
  Occlusion = "Occlusion",
}

export interface SceneOptions {
  gamma: number;
  exposure: number;
  scene: string;
  renderMode: RenderMode;
}

export class SceneOptionsForm {
  private _scene: HTMLSelectElement;
  private _renderMode: HTMLSelectElement;
  private _gamma: HTMLInputElement;
  private _exposure: HTMLInputElement;

  get change$(): Observable<SceneOptions> {
    return this._change$.asObservable();
  }

  set value(value: SceneOptions) {
    this._scene.value = `${value.scene}`;
    this._gamma.value = `${value.gamma}`;
    this._exposure.value = `${value.exposure}`;
    this._renderMode.value = `${value.renderMode}`;
    this._change$.next(value);
  }

  private _change$: BehaviorSubject<SceneOptions>;

  constructor(
    value: SceneOptions,
    scenes: string[],
    protected container: HTMLElement
  ) {
    this._scene = this.container.querySelector("#scene") as HTMLSelectElement;
    this._renderMode = this.container.querySelector(
      "#render-mode"
    ) as HTMLSelectElement;
    this._gamma = this.container.querySelector("#gamma") as HTMLInputElement;
    this._exposure = this.container.querySelector(
      "#exposure"
    ) as HTMLInputElement;

    for (const scene of scenes) {
      this._scene.options.add(
        new Option(scene, scene, scene === value.scene, scene === value.scene)
      );
    }

    for (const key of Object.keys(RenderMode)) {
      this._renderMode.options.add(
        new Option(key, key, key === value.renderMode, key === value.renderMode)
      );
    }

    this._change$ = new BehaviorSubject<SceneOptions>(null);

    this.value = value;

    merge(
      fromEvent(this._scene, "input"),
      fromEvent(this._gamma, "input"),
      fromEvent(this._exposure, "input"),
      fromEvent(this._renderMode, "input")
    )
      .pipe(
        map(
          () =>
            ({
              exposure: parseFloat(this._exposure.value),
              gamma: parseFloat(this._gamma.value),
              scene: `${this._scene.value}`,
              renderMode: `${this._renderMode.value}`
            } as SceneOptions)
        )
      )
      .subscribe(this._change$);
  }
}
