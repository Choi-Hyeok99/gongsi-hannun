import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({effect:undefined as undefined|(()=>undefined|(()=>void)),set:vi.fn(),refresh:vi.fn()}));
vi.mock("react",async importOriginal=>({...await importOriginal<typeof import("react")>(),useEffect:(effect:()=>undefined|(()=>void))=>{mocks.effect=effect;},useState:(initial:unknown)=>[initial,mocks.set]}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
import {OnDemandAiSummary} from "@/components/OnDemandAiSummary";
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function mount(){OnDemandAiSummary({receiptNumber:"20261013000001",originalUrl:"https://dart.fss.or.kr/"});return mocks.effect!();}
function response(status:string,httpStatus=200){return {status:httpStatus,json:async()=>({status,retryAfterSeconds:10})};}
describe("on-demand client lifecycle",()=>{
  it("starts one background POST and refreshes only after ready",async()=>{
    fetcher.mockResolvedValue(response("READY"));mount();await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledWith("/api/disclosures/20261013000001/ai-summary",expect.objectContaining({method:"POST",credentials:"same-origin",cache:"no-store"}));
    expect(mocks.refresh).toHaveBeenCalledOnce();expect(fetcher).toHaveBeenCalledOnce();
  });
  it("polls active work and stops after completion",async()=>{
    fetcher.mockResolvedValueOnce(response("WAITING",202)).mockResolvedValueOnce(response("READY"));mount();await vi.advanceTimersByTimeAsync(10_000);
    expect(fetcher).toHaveBeenCalledTimes(2);expect(mocks.refresh).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(300_000);expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("honors the sixty-second provider cooldown without an immediate retry",async()=>{
    fetcher.mockResolvedValueOnce({status:202,json:async()=>({status:"RETRYING",retryAfterSeconds:60})}).mockResolvedValueOnce(response("READY"));
    mount();await vi.advanceTimersByTimeAsync(59_000);expect(fetcher).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(1_000);expect(fetcher).toHaveBeenCalledTimes(2);expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("never retries quota exhaustion or terminal failures automatically",async()=>{
    fetcher.mockResolvedValue(response("RATE_LIMIT"));mount();await vi.advanceTimersByTimeAsync(300_000);
    expect(fetcher).toHaveBeenCalledOnce();expect(mocks.set).toHaveBeenCalledWith("RATE_LIMIT");expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("stops retries after two minutes and after navigation",async()=>{
    fetcher.mockResolvedValue(response("WAITING",202));const cleanup=mount();await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.set).toHaveBeenCalledWith("DELAYED");const count=fetcher.mock.calls.length;await vi.advanceTimersByTimeAsync(300_000);expect(fetcher).toHaveBeenCalledTimes(count);cleanup?.();
  });
  it("does not update a page or schedule polling after unmount",async()=>{
    fetcher.mockResolvedValue(response("WAITING",202));const cleanup=mount();cleanup?.();await vi.advanceTimersByTimeAsync(300_000);
    expect(fetcher).toHaveBeenCalledOnce();expect(mocks.set).not.toHaveBeenCalled();expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
