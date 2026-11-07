import test from 'node:test';
import assert from 'node:assert/strict';
import {ComparisonLiquidSpecimen} from '../src/compare-boiling-liquid-surface.js';

test('the liquid has a separate free surface, volume and ingredient-specific tint',()=>{
  const specimen=new ComparisonLiquidSpecimen();
  try{
    specimen.update({dish:1,liquid:1,bubbles:.75},'#c5a243',.016);
    assert.equal(specimen.group.visible,true);
    assert.equal(specimen.surface.visible,true);
    assert.equal(specimen.surface.material.uniforms.uColor.value.getHexString(),'c5a243');
    assert.equal(specimen.bubbles.count,30);
    const fullHeight=specimen.surface.position.y;
    specimen.update({dish:1,liquid:.35,bubbles:.25},'#eaf3f7',.016);
    assert.ok(specimen.surface.position.y<fullHeight);
    assert.equal(specimen.bubbles.count,10);
    specimen.update({dish:1,liquid:0,bubbles:0},'#eaf3f7',.016);
    assert.equal(specimen.group.visible,true,'empty glass dish remains');
    assert.equal(specimen.surface.visible,false);
    assert.equal(specimen.bubbles.count,0);
    specimen.update({dish:0,liquid:0,bubbles:0},'#eaf3f7',.016);
    assert.equal(specimen.group.visible,false,'off-pedestal sample has no travelling dish');
  }finally{
    specimen.dispose();
  }
});
