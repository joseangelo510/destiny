import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(process.env.QA_LOCAL_BROWSER_FIXTURE!, 'utf8'));
const url='https://www.g2.com/products/synthetic-test/reviews';
const profile={directory_key:'g2',profile_url:url,status:'saved',http_status:null,last_checked_at:null,public_rating:null,public_review_count:null};
for(const action of ['save','check','remove'])for(const failure of ['network','html502'])test(`${action} recovers after ${failure}`,async({page})=>{
 let shouldFail=false;const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/directory-profiles{,/check}',async route=>{
  if(shouldFail){shouldFail=false;return failure==='network'?route.abort('failed'):route.fulfill({status:502,contentType:'text/html',body:'<html>Bad gateway</html>'});}
  const input=route.request().postDataJSON();expect(input.websiteId).toBe(fixture.mvp.websiteId);
  await route.fulfill({json:{profile:input.remove?{...profile,profile_url:null,status:'not_started'}:route.request().url().endsWith('/check')?{...profile,status:'verified',http_status:200,last_checked_at:'2026-09-21T00:00:00Z'}:profile}});
 });
 await page.goto(`/reviews?site=${fixture.mvp.websiteId}`);
 const input=page.getByRole('textbox',{name:'G2 public profile URL',exact:true});await input.fill(url);
 const card=page.locator('article.directory-profile-card').filter({has:input});
 const save=card.getByRole('button',{name:'Save URL',exact:true});
 if(action!=='save'){await save.click();await expect(card.getByText('URL saved',{exact:true})).toBeVisible();}
 const label=action==='save'?'Save URL':action==='check'?'Check public profile':'Remove saved URL';
 shouldFail=true;await card.getByRole('button',{name:label,exact:true}).click();
 await expect(card.getByRole('status')).toContainText('Try again');
 await expect(card.getByRole('button',{name:label,exact:true})).toBeEnabled();
 await expect(input).toHaveValue(url);
 if(action!=='save')await expect(card.getByText('URL saved',{exact:true})).toBeVisible();
 await card.getByRole('button',{name:label,exact:true}).click();
 await expect(card.getByRole('status')).toContainText(action==='remove'?'Profile URL removed':action==='check'?'Public profile is reachable':'Saved for public-profile monitoring');
 expect(errors).toEqual([]);
});
