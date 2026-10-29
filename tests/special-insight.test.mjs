import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceInsightAnalysis,triggerInsight} from '../src/veil/insights.js';
import {normalInsightModels} from '../src/veil/insight-presentation.js';

test('normal and special share analysis timing while keeping separate slots and icons',()=>{
 const run={carriedInsights:[],analysis:null,events:[],captured:false};
 assert.equal(triggerInsight(run,'ethane',{}).type,'insightAnalysisStart');
 advanceInsightAnalysis(run,5);assert.deepEqual(run.carriedInsights,['ethane']);
 assert.equal(triggerInsight(run,'propane',{}),null);
 run.analysis={id:'normal:reaction',kind:'special',elapsed:0,requiredDuration:5,progress:0};
 assert.equal(advanceInsightAnalysis(run,4.9),null);assert.deepEqual(run.carriedInsights,['ethane']);
 const event=advanceInsightAnalysis(run,.1);assert.equal(event.kind,'special');assert.deepEqual(run.carriedInsights,['ethane']);
 run.specialInsightId=event.id;
 assert.deepEqual(normalInsightModels(run,{state:{recipes:[],hints:[]}}).map(x=>x.category),['fuel','special']);
});
