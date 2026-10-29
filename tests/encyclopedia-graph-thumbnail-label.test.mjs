import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {graphNeighborLabelOffset} from '../src/encyclopedia-graph-view.js';

const [graphViewSource,assetBuilderSource]=await Promise.all([
  readFile(new URL('../src/encyclopedia-graph-view.js',import.meta.url),'utf8'),
  readFile(new URL('../scripts/build-collection-assets.mjs',import.meta.url),'utf8'),
]);

assert.match(assetBuilderSource,/viewBox=\"0 0 192 128\"/,'collection thumbnails keep the shared 3:2 safety canvas');
assert.match(graphViewSource,/\.graph-focus-thumbnail\{[^}]*object-fit:cover/,'Graph thumbnails must crop the shared 3:2 safety margins instead of shrinking the molecule drawing into the node');
assert.match(graphViewSource,/const showThumbnail=!!record&&\(presentation\.showThumbnail\|\|direct\)/,'known direct neighbors must receive structure thumbnails as well as the selected molecule');
assert.match(graphViewSource,/graph-neighbor-label/,'direct-neighbor names must be owned by an external label layer');
assert.match(graphViewSource,/graph-focus-identity graph-focus-label/,'selected identity must live outside the circular node in the focus card');
assert.match(graphViewSource,/overflow-wrap:anywhere/,'long selected names must wrap instead of clipping inside the circular node');
assert.doesNotMatch(graphViewSource,/node\.append\(img,label\)/,'thumbnail and selected identity must no longer compete inside the same circular node');
assert.match(graphViewSource,/for\(const id of projection\.distant\)[\s\S]*addCircle/,'background graph nodes must remain lightweight context marks rather than gaining persistent labels');

const desktopNorth=graphNeighborLabelOffset({angle:-Math.PI/2},{nodeDiameter:66});
const desktopSouth=graphNeighborLabelOffset({angle:Math.PI/2},{nodeDiameter:66});
const desktopEast=graphNeighborLabelOffset({angle:0},{nodeDiameter:66});
assert.equal(desktopNorth.placement,'above','north neighbor label should sit outward from the focus edge');
assert.equal(desktopSouth.placement,'below','south neighbor label should sit outward from the focus edge');
assert.equal(desktopEast.placement,'above','horizontal neighbor label should leave the horizontal focus edge unobstructed');
assert(desktopNorth.y<-33&&desktopSouth.y>33,'desktop labels must clear the 66px circle');

const mobileNorth=graphNeighborLabelOffset({angle:-Math.PI/2},{nodeDiameter:62});
const mobileSouth=graphNeighborLabelOffset({angle:Math.PI/2},{nodeDiameter:62});
assert(mobileNorth.y<-31&&mobileSouth.y>31,'mobile labels must clear the 62px circle without changing the tap target');

console.log('Encyclopedia Graph thumbnail/label polish passed: cropped structure-first thumbnails, external selected/direct labels, lightweight background nodes, mobile/desktop label clearance.');
