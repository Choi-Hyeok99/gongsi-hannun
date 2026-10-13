import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {readOnDemandAiModel} from "@/server/on-demand-ai-env";
afterEach(()=>vi.unstubAllEnvs());
describe("free on-demand model configuration",()=>{
  it("defaults to the stable free Flash-Lite alternative",()=>{
    vi.stubEnv("GEMINI_ON_DEMAND_MODEL",undefined);expect(readOnDemandAiModel()).toBe("gemini-3.1-flash-lite");
  });
  it.each(["gemini-3.1-flash-lite","gemini-3.5-flash-lite"])("permits the explicitly supported free model %s",model=>{
    vi.stubEnv("GEMINI_ON_DEMAND_MODEL",` ${model} `);expect(readOnDemandAiModel()).toBe(model);
  });
  it.each(["gemini-pro","other-paid-model","https://external.example"])("fails closed for an unapproved %s",model=>{
    vi.stubEnv("GEMINI_ON_DEMAND_MODEL",model);expect(()=>readOnDemandAiModel()).toThrow("AI_INVALID_REQUEST");
  });
});
