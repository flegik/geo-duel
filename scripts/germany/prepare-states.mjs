import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';

// Feed this script the raw WFS polygons, their topology-preserving Mapshaper
// reduction and 16 verified original Wikimedia SVGs in the source directory.
const input = process.argv[2];
assert(input, 'Pass a source directory. See data/germany/SOURCES.md.');
const data = 'data/germany';
const read = name => readFileSync(join(input, name), 'utf8');
const raw = JSON.parse(read('lands.json')).features.filter(f => f.properties.gf === 4);
const simplified = JSON.parse(read('lands-simplified.json')).features;
assert.equal(raw.length, 16);
const catalog = Object.fromEntries(readFileSync(join(data, 'states.tsv'), 'utf8').trim().split(/\r?\n/).map(line => {
 const [code, name, capital, capitalAgs, file, flagDetail, flagLaw] = line.split('\t');
 return [code, {name, capital, capitalAgs, file, flagDetail, flagLaw}];
}));
const hash = value => createHash('sha256').update(value).digest('hex');
const neighbors = new Map(Object.keys(catalog).map(code => [code, new Set()]));
const edges = new Map();
const rings = ({type, coordinates}) => type === 'MultiPolygon' ? coordinates.flat() : coordinates;
for (const {properties: {lkz}, geometry} of raw) {
 for (const ring of rings(geometry)) for (let i = 1; i < ring.length; i++) {
  const key = [ring[i-1].join(','), ring[i].join(',')].sort().join('/');
  const previous = edges.get(key);
  if (previous && previous !== lkz) {
   neighbors.get(lkz).add(previous);
   neighbors.get(previous).add(lkz);
  }
  edges.set(key, lkz);
 }
}

// Local equirectangular projection at 51°N. Input is always [lon, lat].
// The same transform is used for SVG paths and city points.
const factor = Math.cos(51 * Math.PI / 180);
const project = ([lon, lat]) => [(lon - 5.5) * 100 * factor, (55.1 - lat) * 100]
 .map(n => Number(n.toFixed(2)));
const paths = simplified.map(({properties: {lkz}, geometry}) => ({
 code: lkz,
 path: rings(geometry).map(ring => ring.slice(0,-1).map((point, i) =>
  (i ? 'L' : 'M') + project(point).join(',')).join('') + 'Z').join(''),
}));
assert.equal(new Set(paths.map(p => p.code)).size, 16);
const viewBox = '-14 -15 660 827';
const svgDir = 'public/media/de';
mkdirSync(svgDir,{recursive:true});
const objects = raw.map(({properties: {lkz, ags, gen, ewz, kfl}}) => {
 const {file, ...info} = catalog[lkz];
 assert.equal(info.name, gen);
 const key = hash('geoduel.de:' + ags).slice(0,12);
 const flag = `/media/de/${key}.svg`;
 const original = read(file);
 // Strip editor metadata and embedded titles from quiz media.
 const svg = original.replace(/<!--[\s\S]*?-->/g, '').replace(/<(title|desc|metadata)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<\?xml[^>]*\?>/g,'').replace(/<!DOCTYPE[^>]*>/g,'').trim();
 assert.match(svg, /^<svg\b/);
 assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?!#)/i);
 writeFileSync('public' + flag, svg + '\n');
 return {...info, code:lkz, ags, neighbors:[...neighbors.get(lkz)].sort(), population:ewz, area:kfl,
  flag, flagSource:'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file), flagHash:hash(svg + '\n'), mapKey:key};
});
assert.equal(objects.length, Object.keys(catalog).length);
writeFileSync(join(data,'states.json'), JSON.stringify(objects,null,2) + '\n');
writeFileSync(join(data,'map.json'), JSON.stringify({viewBox,paths}) + '\n');
