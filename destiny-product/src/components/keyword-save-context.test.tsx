import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {KeywordSerpInsights,KeywordSerpDrawer} from './keyword-serp-insights';
const noop=()=>undefined;
describe('keyword save website context',()=>{
 it('explains unavailable question and related saves while keeping research enabled',()=>{
  const html=renderToStaticMarkup(<KeywordSerpInsights canSave={false} questions={['A question?']} related={['related phrase']} onSave={noop} onResearch={noop}/>);
  expect(html.match(/disabled=""[^>]*>Choose a website to save/g)).toHaveLength(2);
  expect(html).toContain('<button type="button">Research this</button>');
 });
 it('explains unavailable saves inside the first-page drawer',()=>{
  const html=renderToStaticMarkup(<KeywordSerpDrawer canSave={false} keyword="topic" loading={false} onSave={noop} onRetry={noop} onClose={noop} snapshot={{keyword:'topic',location:'United States',checkedAt:'2026-09-21T00:00:00Z',organic:[],questions:['A question?'],related:[]}}/>);
  expect(html).toMatch(/disabled=""[^>]*>Choose a website to save/);
 });
 it('keeps saving and saved-list labels when website context exists',()=>{
  const html=renderToStaticMarkup(<KeywordSerpInsights canSave questions={['A question?']} related={['saved phrase']} savedLabels={{'saved phrase':'Research'}} onSave={noop} onResearch={noop}/>);
  expect(html).toContain('<button type="button">Save</button>');
  expect(html).toContain('Saved to Research ✓');
  expect(html).not.toContain('Choose a website to save');
 });
});
