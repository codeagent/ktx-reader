import { Observable, BehaviorSubject, fromEvent, merge } from "rxjs";
import { map } from "rxjs/operators";

export interface SceneOptions {
  gamma: number;
  exposure: number;
  scene: string;
}

export class SceneOptionsForm {
  private _scene: HTMLSelectElement;
  private _gamma: HTMLInputElement;
  private _exposure: HTMLInputElement;

  get change$(): Observable<SceneOptions> {
    return this._change$.asObservable();
  }

  private _change$: BehaviorSubject<SceneOptions>;

  constructor(
    value: SceneOptions,
    scenes: string[],
    protected container: HTMLElement
  ) {
    this._scene = this.container.querySelector("#scene") as HTMLSelectElement;
    this._gamma = this.container.querySelector("#gamma") as HTMLInputElement;
    this._exposure = this.container.querySelector(
      "#exposure"
    ) as HTMLInputElement;

    this._scene.value = `${value.scene}`;
    this._gamma.value = `${value.gamma}`;
    this._exposure.value = `${value.exposure}`;

    for (const scene of scenes) {
      this._scene.options.add(new Option(scene, scene, scene === value.scene, scene === value.scene));
    }

    this._change$ = new BehaviorSubject<SceneOptions>(value);

    merge(
      fromEvent(this._scene, "input"),
      fromEvent(this._gamma, "input"),
      fromEvent(this._exposure, "input")
    )
      .pipe(
        map(
          () =>
            ({
              exposure: parseFloat(this._exposure.value),
              gamma: parseFloat(this._gamma.value),
              scene: `${this._scene.value}`
            } as SceneOptions)
        )
      )
      .subscribe(this._change$);
  }
}
