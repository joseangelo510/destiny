import {describe,expect,it} from "vitest";
import {reviewPresentation} from "./review-presentation";
describe("honest review progress",()=>{
 it("does not call an unhydrated draft failed or approved",()=>{
  expect(reviewPresentation(false,false,"generated",false)).toMatchObject({pending:true,label:"Loading saved review",summary:"Loading saved review decisions…"});
 });
 it("keeps pending verification distinct from an actual quality failure",()=>{
  expect(reviewPresentation(true,false,"generated",false)).toMatchObject({pending:true,label:"Checking draft",summary:"Checking the saved article…"});
  expect(reviewPresentation(true,true,"generated",false)).toMatchObject({pending:false,label:"Needs another pass"});
 });
 it("shows a pass only after loading and checking finish",()=>{
  expect(reviewPresentation(true,true,"generated",true)).toMatchObject({pending:false,label:"Ready for human review",summary:"Internal checks passed"});
 });
});
