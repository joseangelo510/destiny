import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const fixturePath=process.env.QA_LOCAL_BROWSER_FIXTURE;
if(!fixturePath) throw new Error('Disposable browser fixture required.');
const fixture=JSON.parse(readFileSync(fixturePath,'utf8')) as {mvp:{websiteId:string}};
test('@gate shared status chips and pipeline counts remain readable',async({page})=>{
 await page.route('**/api/integrations/cms/wordpress/reconcile',route=>route.abort());
 await page.goto(`/content?site=${fixture.mvp.websiteId}`);
 await expect(page.locator('.strategy-pipeline-strip nav a small').first()).toBeVisible();
 await expect(page.locator('.status-chip.amber').first()).toBeVisible();
 const results=await new AxeBuilder({page}).include('.strategy-pipeline-strip').include('.status-chip.amber').withRules(['color-contrast']).analyze();
 expect(results.violations).toEqual([]);
});
test('@gate weekly step counts remain readable',async({page})=>{
 await page.goto(`/this-week?site=${fixture.mvp.websiteId}`);
 const close=page.getByRole('button',{name:'Close plan reveal'});
 if(await close.isVisible()) await close.click();
 await expect(page.locator('.weekly-map-step-copy em').first()).toBeVisible();
 const results=await new AxeBuilder({page}).include('.weekly-map-step-copy').withRules(['color-contrast']).analyze();
 expect(results.violations).toEqual([]);
});
