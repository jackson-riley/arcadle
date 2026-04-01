declare module "to-ico" {
  import type { Buffer } from "node:buffer";

  function toIco(
    input: Buffer[],
    opts?: { resize?: boolean; sizes?: number[] }
  ): Promise<Buffer>;

  export default toIco;
}
