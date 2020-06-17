import { readKtx } from "./ktx-reader";

import bytes from "./pillars_2k_skybox.ktx.html";
const encoder = new TextEncoder();
const raw = encoder.encode(bytes);

const info = readKtx(raw.buffer);
