import { readKtx } from "./ktx-reader";


// const encoder = new TextEncoder();
// const raw = encoder.encode(pillars_2k_skybox);
// const info = readKtx(raw.buffer);
fetch(
  "https://cdn.jsdelivr.net/gh/codeagent/ktx-reader@master/pillars_2k_ibl.ktx"
)
  .then(r => r.arrayBuffer())
  .then(b => {
    const info = readKtx(b);
    console.log(info);
  });
