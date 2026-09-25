import { afterEach, describe, expect, it, vi } from "vitest";
import { DataForSeoResearchClient, parseKeywordResearch } from "./research";
import { parseKeywordRows } from "../../../supabase/functions/seo-research/logic";
const seed={keyword:"exact phrase",keyword_info:{search_volume:40}};
const suggestion={keyword:"different phrase",keyword_info:{search_volume:20}};
const payload={status_code:20000,tasks:[{status_code:20000,result:[
  {seed_keyword:"exact phrase",seed_keyword_data:seed},
  {total_count:250,items_count:1,offset:100,items:[suggestion]},
]}]};
afterEach(()=>vi.unstubAllGlobals());
for(const [name,parse] of [["server",parseKeywordResearch],["Edge",parseKeywordRows]] as const){
 describe(`${name} split provider results`,()=>{
  it("retains suggestions stored after the seed result",()=>{
   expect(parse(payload).map(row=>[row.keyword,row.volume])).toEqual([["exact phrase",40],["different phrase",20]]);
  });
  it("works when result order is reversed",()=>{
   expect(parse({...payload,tasks:[{status_code:20000,result:[...payload.tasks[0].result].reverse()}]}).map(row=>row.keyword)).toEqual(["exact phrase","different phrase"]);
  });
 });
}
it("preserves provider index count and requested pagination with split results",async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>payload});vi.stubGlobal("fetch",fetcher);
 const result=await new DataForSeoResearchClient("fixture","fixture").keywordResearch({query:"exact phrase",mode:"keyword",offset:100});
 expect(result.metrics.totalKeywords).toBe(250);
 expect(result.rows).toHaveLength(2);
 expect(JSON.parse(fetcher.mock.calls[0][1].body)[0].offset).toBe(100);
});
