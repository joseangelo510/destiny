import {describe,expect,it} from "vitest";
import {buildPublicationReceipt} from "./publication-receipt";
describe("actionable publication failure",()=>{
 it("explains missing media without claiming verified publication",()=>{
  const receipt=buildPublicationReceipt({publicationStatus:"verification_failed",verificationEvidence:{reason:"The published page is missing its required featured image metadata."}});
  expect(receipt.detail).toContain("missing its required featured image");
  expect(receipt.canShare).toBe(false);
 });
 it("retains generic guidance for malformed reasons",()=>{
  const receipt=buildPublicationReceipt({publicationStatus:"verification_failed",verificationEvidence:{reason:{text:"not a message"}}});
  expect(receipt.detail).toContain("public verification did not pass");
 });
});
