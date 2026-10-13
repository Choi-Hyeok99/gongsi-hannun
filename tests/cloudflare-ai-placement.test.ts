import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
describe("Cloudflare backend placement",()=>{
  it("runs near the supported Korean DB region, without introducing paid infrastructure",()=>{
    const config=JSON.parse(readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8"));
    expect(config.placement).toEqual({region:"aws:ap-northeast-2"});
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(config.durable_objects).toBeUndefined();expect(config.queues).toBeUndefined();expect(config.ai).toBeUndefined();
  });
});
