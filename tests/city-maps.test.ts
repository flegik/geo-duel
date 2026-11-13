import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CityQuestionMap} from '../src/CityQuestionMap';
import questions from '../data/question-pool/city-maps.json';
import anchors from '../data/learning/map-country-anchors.json';
import atlas from '../data/atlas/geography.json';
import {cityMapViewport,pathPoints,projectWorldPoint} from '../src/mapViewport';
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

test('all stored anchors are geographic points inside their rendered country',()=>{
 for(const [iso,point] of Object.entries(anchors)){
  const [lat,lon]=point;
  assert.ok(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180,iso);
  const [x,y]=projectWorldPoint(point);
  const features=atlas.world.filter(feature=>feature.iso===iso);
  const inside=features.some(({path})=>{
   let inside=false;
   for(const ring of path.match(/M[^M]+/g)??[]){
    const vertices=pathPoints(ring);
    for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
     const [x0,y0]=vertices[j], [x1,y1]=vertices[i];
     if((y0>y)!==(y1>y)&&x<x0+(y-y0)*(x1-x0)/(y1-y0))inside=!inside;
    }
   }
   return inside;
  });
  assert.ok(inside,`${iso} anchor lies outside its Natural Earth polygons`);
 }
});

test('all 201 questions fit their markers and revealed city without repeating the world',()=>{
 const points:Record<string,number[]>=anchors;
 const highlighted=new Set(['Dschidda','Osaka','Kyoto','Innsbruck','Vancouver','Melbourne','Auckland']);
 for(const q of questions){
  const {name,point}=q.provenance.cityLocation;
  const markers=q.options.map(option=>projectWorldPoint(points[countries.get(option)!]));
  const city=projectWorldPoint(point);
  const initial=cityMapViewport(markers), solved=cityMapViewport(markers,city);
  for(const [view,visible] of [[initial,markers],[solved,[...markers,city]]] as const){
   const {left,top,width,height,scaleX,offsets,toViewport}=view;
   assert.ok(width/scaleX<360&&height<360,`${name}: expected a regional crop`);
   assert.ok(offsets.length===1||offsets.length===2,name);
   if(offsets.length===2)assert.equal(offsets[1]-offsets[0],720,name);
   for(const p of visible){
    const [x,y]=toViewport(p),margin=width*.03;
    assert.ok(x>=left+margin&&x<=left+width-margin&&y>=top+margin&&y<=top+height-margin,name);
    assert.ok(offsets.some(offset=>Math.abs(x-(p[0]+offset)*scaleX)<1e-9),name);
    assert.equal(y,p[1],name);
   }
   const positioned=markers.map(toViewport);
   for(const [i,[x,y]] of positioned.entries()){
    for(const [otherX,otherY] of positioned.slice(i+1)){
     // Two visible discs must stay individually readable on a narrow phone.
     assert.ok(Math.hypot(x-otherX,y-otherY)>=width*.05,name);
    }
   }
  }
  if(!highlighted.delete(name))continue;
  const location={...q.provenance.cityLocation,point:point as [number,number]};
  const onSelect=()=>{};
  const pending=renderToStaticMarkup(createElement(CityQuestionMap,{options:q.options,onSelect}));
  const hidden=renderToStaticMarkup(createElement(CityQuestionMap,{options:q.options,onSelect,location,selected:(q.correct+1)%4}));
  assert.equal(hidden,pending,name);
  assert.equal((pending.match(/role="button"/g)??[]).length,4,name);
  const after=renderToStaticMarkup(createElement(CityQuestionMap,{options:q.options,location,correct:q.correct,selected:(q.correct+1)%4}));
  assert.equal((after.match(/city-country-pin correct/g)??[]).length,1,name);
  assert.equal((after.match(/city-country-pin incorrect/g)??[]).length,1,name);
  assert.ok(after.includes(`class="city-location-pin" transform="translate(${solved.toViewport(city).join(' ')})"`),name);
 }
 assert.equal(highlighted.size,0);
});

test('dateline and microstate-scale points use the same projected map frame',()=>{
 const markers=([[0,179],[1,-179],[2,178],[3,-178]]).map(projectWorldPoint);
 const view=cityMapViewport(markers);
 assert.equal(view.offsets.length,2);
 assert.ok(view.width/view.scaleX<35);
 const west=projectWorldPoint([0,-180]),east=projectWorldPoint([0,180]);
 assert.deepEqual(view.toViewport(west),view.toViewport(east));
 const microstate=projectWorldPoint([41.903,12.453]);
 const nearby=cityMapViewport([microstate,...[[41.9,12.48],[43.94,12.46],[43.74,7.42]].map(projectWorldPoint)]);
 const [x,y]=nearby.toViewport(microstate);
 assert.ok(x>=nearby.left&&x<=nearby.left+nearby.width);
 assert.ok(y>=nearby.top&&y<=nearby.top+nearby.height);
});
