import {describe,expect,it} from "vitest";
import {renderInfographicSvg,type InfographicSpec} from "./article-generation";
const base:InfographicSpec={id:"fixture",template:"timeline",title:"Typical Job Background Check Timelines",insight:"Check timelines depend on the components requested.",items:[],sourceIds:[],sourceLabel:"Source: fixture",altText:"Timeline",caption:"Timeline",placementAfterHeading:"Timelines"};
const visible=(svg:string)=>[...svg.matchAll(/<(?:text|tspan)\b[^>]*>([^<]*)<\//g)].map(match=>match[1]).join(" ");
describe("inline graphics preserve source text",()=>{
 it("keeps complete63character timeline rows",()=>{
  const items=["Basic identity + criminal database: same day, sometimes seconds","With employment or education verification: 3 to 7 business days"];
  const text=visible(renderInfographicSvg({...base,items}));
  for(const item of items)expect(text.replace(/\s+/g," ")).toContain(item);
 });
 it("preserves long headers, sources, and every supplied item",()=>{
  const title="A complete title that must remain available beyond the old forty eight character cutoff";
  const insight="A detailed explanation ".repeat(6).trim();
  const sourceLabel="Verified source description ".repeat(7).trim();
  const items=Array.from({length:9},(_,i)=>`Item number ${i+1}`);
  const text=visible(renderInfographicSvg({...base,title,insight,sourceLabel,items})).replace(/\s+/g," ");
  for(const value of [title,insight,sourceLabel,...items])expect(text).toContain(value);
 });
 it("wraps long unbroken tokens without losing characters or XML escaping",()=>{
  const token="x".repeat(180);
  const svg=renderInfographicSvg({...base,items:[token,"A < B & C > D"]});
  expect(visible(svg).replace(/\s/g,"")).toContain(token);
  expect(svg).toContain("&lt;");expect(svg).toContain("&amp;");expect(svg).not.toContain("A < B");
 });
});
