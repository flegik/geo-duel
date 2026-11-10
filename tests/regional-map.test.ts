import {test} from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import geo from '../data/atlas/geography.json';import water from '../data/atlas/water.json';import registry from '../data/flags/registry.json';import {regionalViews} from '../src/mapViewport';import {AtlasGeography} from '../src/AtlasGeography';
const views=(iso:string)=>regionalViews(geo.world.filter(f=>f.iso===iso).map(f=>f.path));
test('All 195 countries have finite regional cameras, padding and latitude correction without global fallback',()=>{
 for(const country of registry){const regions=views(country.iso);assert.ok(regions.length,country.iso);for(const v of regions){assert.ok(!/NaN|Infinity/.test(v.viewBox));assert.ok(v.width>0&&v.height>0);assert.ok(v.sourceWidth<650,`${country.iso}: no full-world viewport`);assert.ok(v.scaleX>=.25&&v.scaleX<=1);assert.ok(v.aspect===.9||v.aspect===1.6);}}
});
test('Microstates get contextual closeups; elongated countries use portrait and islands across the date line remain regional',()=>{
 for(const iso of ['VA','MC','SM'])assert.ok(views(iso)[0].detail,iso);
 assert.equal(views('CL')[0].aspect,.9);assert.ok(views('FJ')[0].sourceWidth<60);assert.ok(views('KI').length>1);assert.ok(views('US').length>1);
 for(const iso of ['DE','CH','NP','IT'])assert.ok(views(iso)[0].sourceWidth<120);
});
test('Regional maps consistently show target, neutral context, water and orientation in atlas/quiz use',()=>{
 for(const iso of ['VA','FJ','CL','NP','CH','DE']){const html=renderToStaticMarkup(createElement(AtlasGeography,{iso,name:'gesuchtes Land'}));assert.ok(html.includes('regional-map'));assert.ok(html.includes('#6fe0c4'));assert.ok(html.includes('#34495a'));assert.ok(html.includes('#102435'));assert.ok(html.includes('N ↑'));assert.ok(!html.includes('Land vergrößert ansehen'));if(iso==='VA')assert.ok(html.includes('unmittelbare Umgebung'));}
 assert.ok(water.some(l=>l.name.includes('Victoria')));assert.ok(water.some(l=>l.name.includes('Geneva')));assert.ok(water.every(l=>l.path.startsWith('M')&&!l.path.includes('NaN')));
});
