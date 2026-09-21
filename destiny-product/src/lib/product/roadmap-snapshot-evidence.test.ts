import {describe,expect,it} from 'vitest';
import {buildSeoRoadmap} from './roadmap';

describe('snapshot-supported roadmap evidence',()=>{
 it.each([16.8,4.2])('describes position %s as current visibility, not improvement',async position=>{
  const result=await buildSeoRoadmap({auditComplete:true,quests:[],searchConsole:{impressions:100,clicks:25,topQueries:[{query:'fixture',position}]},analytics:{organicKeyEvents:1}});
  const node=result.nodes.find(n=>n.id==='page-two')!;
  expect(node.state).toBe('complete');
  expect(node.label).toBe('Top-20 search visibility');
  expect(node.description).not.toMatch(/improv|advance|growth/i);
  expect(node.evidence).toContain(position.toFixed(1));
  expect(node.evidence).toContain('does not establish improvement');
  const combined=result.nodes.find(n=>n.id==='compounding-authority')!;
  expect(combined.label).toBe('Search and customer activity');
  expect(combined.description).not.toMatch(/repeat|consisten|grow|compound/i);
  if(position<=10){
   expect(combined.state).toBe('complete');
   expect(combined.evidence).toContain('does not establish sustained growth');
  }
 });
 it('does not assert a top-20 milestone without ranking evidence',async()=>{
  const result=await buildSeoRoadmap({auditComplete:true,quests:[],searchConsole:{impressions:100,clicks:25,topQueries:[]},analytics:{organicKeyEvents:1}});
  expect(result.nodes.find(n=>n.id==='page-two')?.state).not.toBe('complete');
  expect(result.nodes.find(n=>n.id==='compounding-authority')?.state).not.toBe('complete');
 });
});
