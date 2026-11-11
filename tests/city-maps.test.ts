import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CityQuestionMap} from '../src/CityQuestionMap';
import questions from '../data/question-pool/city-maps.json';
import anchors from '../data/learning/map-country-anchors.json';
import registry from '../data/flags/registry.json';
import {countryContinent} from '../src/selection';

const countries=new Map(registry.map(country=>[country.name,country.iso]));

test('201 sourced city locations, five continents, no African question or option',()=>{
 assert.equal(questions.length,201);
 assert.equal(new Set(questions.map(q=>q.provenance.cityLocation.name)).size,201);
 assert.equal(new Set(questions.map(q=>countryContinent(q.provenance.iso))).size,5);
 for(const q of questions){
  const iso=q.provenance.iso;
  const [lat,lon]=q.provenance.cityLocation.point;
  assert.equal(q.provenance.subjectKey,`maps:${iso}`);
  assert.ok(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180);
  assert.equal(countries.get(q.options[q.correct]),iso);
  assert.equal(q.provenance.cityLocation.iso,iso);
  assert.ok(q.options.every(option=>{
   const code=countries.get(option)!;
   return code in anchors&&countryContinent(code)!=='Afrika';
  }));
  assert.equal(new Set(q.options).size,4);
  assert.ok(q.provenance.cityLocation.sourceRow||q.provenance.cityLocation.sourceId==='Q34600');
  assert.equal(q.media.src,'choice:city-map');
  assert.ok(!JSON.stringify(q.media).includes(String(lat)));
 }
});
test('The map offers four equivalent controls before answering and reveals exactly one city point after',()=>{
 const q=questions.find(q=>q.provenance.cityLocation.name==='Osaka')!;
 const initial=renderToStaticMarkup(createElement(CityQuestionMap,{options:q.options,onSelect:()=>{}}));
 assert.equal((initial.match(/class="city-country-pin /g)??[]).length,4);
 assert.equal((initial.match(/role="button"/g)??[]).length,4);
 assert.doesNotMatch(initial,/city-location-pin|Lage von Osaka|city-country-pin correct/);
 const location={...q.provenance.cityLocation,point:q.provenance.cityLocation.point as [number,number]};
 const after=renderToStaticMarkup(createElement(CityQuestionMap,{options:q.options,location,correct:q.correct}));
 assert.equal((after.match(/city-location-pin/g)??[]).length,1);
 assert.match(after,/Lage von Osaka/);
 assert.match(after,/city-country-pin correct/);
});
