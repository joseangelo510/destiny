import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
const fixture=JSON.parse(readFileSync(process.env.QA_LOCAL_BROWSER_FIXTURE!, 'utf8'));
const plan={title:'Acceptance evidence plan',subtitle:'Synthetic recovery test',audience:'Test audience',visualDirection:'Editorial',altText:'Synthetic infographic',sections:Array.from({length:4},(_,i)=>({id:`s${i}`,eyebrow:'Test',title:`Evidence panel ${i}`,takeaway:'Synthetic evidence for recovery testing.',dataPoints:[{value:'24%',label:'Synthetic metric',context:'Not measured real-world data.',sourceIds:[`source${i}`]}]})),sources:Array.from({length:4},(_,i)=>({id:`source${i}`,title:`Synthetic source ${i}`,url:`https://research.example/report-${i}`,publisher:'Test fixture',publishedAt:'2026-09-21'})),article:{title:'Acceptance evidence article',metaTitle:'Acceptance evidence article',metaDescription:'Synthetic recovery test',markdown:'# Acceptance evidence article\n\n'+('Synthetic evidence context. '.repeat(180))},repurposeCards:Array.from({length:4},(_,i)=>({id:`c${i}`,title:`Synthetic post ${i}`,copy:'Fixture copy only.',recommendedChannel:'LinkedIn',sourceIds:[`source${i}`]}))};
test('Retain infographic work after failed replacement and replace on success',async({page},testInfo)=>{
 let calls=0;
 await page.route('**/api/content/infographic/render',async route=>{
  expect(route.request().postDataJSON().billingUsageId).toBe('11111111-1111-4111-8111-111111111111');
  await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZ0AAAAASUVORK5CYII=','base64')});
 });
 await page.route('**/api/content/infographic/research',async route=>{
  calls++;
  await route.fulfill(calls===2?{status:502,json:{error:'The operation was aborted due to timeout'}}:{json:{billingUsageId:'11111111-1111-4111-8111-111111111111',plan:calls===3?{...plan,article:{...plan.article,title:'Replacement evidence article'}}:plan,model:'synthetic-fixture',retrievedSourceCount:4}});
 });
 await page.goto(`/content/infographics?site=${fixture.mvp.websiteId}`);
 await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('custom');
 await page.getByLabel('Your topic',{exact:true}).fill('Acceptance recovery test');
 const research=page.getByRole('button',{name:'Research current sources',exact:true});
 await expect(research).toBeEnabled();
 await research.click();
 await expect(page.getByText('Review the evidence before creating',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Acceptance evidence article',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Looks good — create infographic',exact:true}).click();
 const download=page.getByRole('link',{name:'Download PNG',exact:true});
 await expect(download).toBeVisible();
 const originalImage=await download.getAttribute('href');
 await page.getByRole('button',{name:'Research again',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Rebound SEO needs your attention'})).toContainText('aborted due to timeout');
 // Existing work must survive a failed replacement request.
 await expect(page.getByText('Review the evidence before creating',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Acceptance evidence article',exact:true})).toBeVisible();
 await expect(download).toHaveAttribute('href',originalImage!);
 await expect(page.getByRole('button',{name:'Download Google Docs-ready article',exact:true})).toBeEnabled();
 await page.screenshot({path:testInfo.outputPath('failed-retry-retained-plan.png'),fullPage:true});
 await research.click();
 await expect(page.getByRole('heading',{name:'Replacement evidence article',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Acceptance evidence article',exact:true})).toHaveCount(0);
 await expect(download).toHaveCount(0);
 expect(calls).toBe(3);
 await page.screenshot({path:testInfo.outputPath('replacement-succeeded.png'),fullPage:true});
});
