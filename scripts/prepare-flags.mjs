// One-time/import maintenance: native-ratio Public Domain SVGs from Flagpedia.
import fs from 'node:fs/promises';import crypto from 'node:crypto';
const codes=`af al dz ad ao ag ar am au at az bs bh bd bb by be bz bj bt bo ba bw br bn bg bf bi cv kh cm ca cf td cl cn co km cg cd cr ci hr cu cy cz dk dj dm do ec eg sv gq er ee sz et fj fi fr ga gm ge de gh gr gd gt gn gw gy ht hn hu is in id ir iq ie il it jm jp jo kz ke ki kp kr kw kg la lv lb ls lr ly li lt lu mg mw my mv ml mt mh mr mu mx fm md mc mn me ma mz mm na nr np nl nz ni ne ng mk no om pk pw ps pa pg py pe ph pl pt qa ro ru rw kn lc vc ws sm st sa sn rs sc sl sg sk si sb so za ss es lk sd sr se ch sy tj tz th tl tg to tt tn tr tm tv ug ua ae gb us uy uz vu va ve vn ye zm zw`.split(' ');
if(new Set(codes).size!==195)throw Error(`Expected 195: ${codes.length}`);
const names=new Intl.DisplayNames('de',{type:'region'});
const overrides={va:'Vatikanstadt',ps:'Palästina',ci:'Elfenbeinküste',cd:'Demokratische Republik Kongo',cg:'Republik Kongo',cv:'Cabo Verde',sz:'Eswatini',tl:'Timor-Leste',fm:'Mikronesien',st:'São Tomé und Príncipe',mm:'Myanmar',tr:'Türkei'};
// Authored visual families; overlap is intentional (colour, geometry, symbols, regional tradition).
const definitions=[
 ['red-white-bands','Rot-weiße Streifen','pl mc id sg at lv pe ca bh qa mt lb'],
 ['blue-white-red-horizontal','Blau-weiß-rote Querstreifen','nl lu ru si sk hr rs py'],
 ['blue-yellow-red-vertical','Blau-gelb-rote Längsstreifen','ro td md ad'],
 ['green-white-orange-vertical','Grün-weiß-orange/rote Längsstreifen','ie ci it mx'],
 ['vertical-tricolour','Vertikale Trikoloren','fr it mx ie ci be ro td md ad ml gn sn cm ng ne mn'],
 ['nordic-cross','Skandinavische Kreuze','dk se no fi is'],
 ['cross','Kreuzmotive','ch ge gr gb dk se no fi is mt do'],
 ['southern-cross-ensign','Südkreuz und britischer Kanton','au nz fj tv'],
 ['british-heritage','Britischer Kanton oder karibische Symbolik','au nz fj tv gb ws bz bb bs ag'],
 ['andean-tricolour','Gelb-blau-rote Querstreifen','co ec ve am'],
 ['central-american','Blau-weiß-blaue mittelamerikanische Flaggen','gt hn sv ni ar'],
 ['blue-white-horizontal','Blau-weiße Querstreifen','ar uy gr il hn sv ni gt'],
 ['pan-arab','Panarabische Farben und Streifen','ps jo sd ae kw sy iq eg ye ly ss om'],
 ['arabic-script','Arabische Schrift oder Schwert','sa af iq'],
 ['crescent','Halbmond und Stern','tr tn dz pk mv mr az uz tm my sg km ly'],
 ['pan-african','Grün-gelb-rote panafrikanische Farben','ml gn sn cm gh bf bj tg gw et bo st cg ga mz sz er za zm zw cf bi gq mm sr'],
 ['green-yellow-red-horizontal','Grün-gelb-rote Querstreifen','et bo gh lt bj bf'],
 ['red-yellow-green-star','Stern auf panafrikanischen Farben','sn cm gh bf gw st tg'],
 ['blue-yellow','Blau und Gelb','ua pw kz se bs ba bb rw'],
 ['red-white-blue-stars','Rot-weiß-blau mit Sternen','us lr my cu pr cl pa kp ws'],
 ['red-stars','Rote Fläche mit Sternen','cn vn ma tr tn kg'],
 ['disc','Kreis/Sonne auf einfarbiger Fläche','jp bd pw la kr kz kg ne'],
 ['sun','Sonnenmotive','jp ar uy kz kg ki na mk ph tw np'],
 ['diagonal','Diagonalen und Dreiecke','tz cd cg na bs tt kn gy sb sc mz er pg bt bh qa za'],
 ['pacific-blue','Blaue pazifische Sternflaggen','fm mh nr pw sb au nz tv fj'],
 ['pacific-red','Rote pazifische Flaggen','ws to ki pg vu'],
 ['red-blue-horizontal','Rot-blaue Querstreifen','ht li kh la am az'],
 ['green-white','Grün-weiße Flaggen','ng pk dz sa mv'],
 ['red-white-black','Rot-weiß-schwarze Flaggen','eg ye iq sy sd ke tt ao'],
 ['green-red','Grün und Rot','pt bd mg by mz'],
 ['white-symbol','Weißer Grund mit Symbol','cy kr sm af jp va'],
 ['caribbean','Karibische Symbole und Farbflächen','ag bs bb bz dm do gd ht jm kn lc vc tt cu'],
 ['island-emblem','Inselstaaten mit komplexem Wappen/Symbol','bz dm gd ht do fj ki lk bn bt sz'],
 ['blue-red-emblem','Blau-rot mit Wappen','li ht kh rs hr sk si'],
 ['red-green-blue','Blau-rot-grüne Flaggen','az gm uz er dj'],
 ['black-red-yellow','Schwarz-rot-gelbe Flaggen','de be ao ug tl pg'],
 ['horizontal-tricolour','Horizontale Trikoloren','de hu bg lt ee am ru nl lu co ec ve in ir tj sl ga gm mu bw ls mw'],
 ['stars-and-triangle','Dreieck und Sterne','cu dj km ph tl st ss'],
 ['unique-symbol','Markante Einzelmotive','np bt lk bn cy sm va al me mk ge sc'],
 ['baltic-central-europe','Europäische Streifen','ee lv lt hu bg at pl cz sk si hr rs'],
];
definitions.push(['blue-white-stars','Blauer Grund mit weißen Sternen','so fm nr sb au nz mh'],['green-yellow-blue','Grün-gelb-blaue Farbflächen','br ga rw vc sb'],['red-yellow-emblem','Rot und Gelb mit Symbol','es cn vn mk kg lt'],['red-blue-white-bands','Rot-blau-weiße Querstreifen','th cr cv kp py hr']);
const groups=definitions.map(([id,description,members])=>({id,description,members:members.split(' ').filter(c=>codes.includes(c))}));
const preferred={pl:['mc','id','sg'],ro:['td','md','ad'],ie:['ci','it','mx'],nl:['lu','ru','py'],au:['nz','fj','tv'],si:['sk','hr','rs'],co:['ec','ve','am'],de:['be','ug','ao'],fr:['it','ro','ie'],it:['mx','ie','ci'],mc:['pl','sg','at'],id:['pl','sg','at'],td:['md','ad','ro'],ci:['ie','it','mx'],nz:['au','fj','tv'],ps:['jo','sd','ae'],jo:['ps','sd','kw'],ch:['dk','ge','to'],jp:['bd','pw','kr'],es:['pt','ad','lt'],gb:['au','nz','fj']};
// Practically indistinguishable at quiz size: never opposing answer options.
const excluded=[['mc','id'],['ro','td']];
const known=new Set('de fr it es gb us ca br jp au se no fi pl gr pt ch at tr mx ar cl pe co ma eg ke th vn nz ru cn in ua nl ie dk be za kr'.split(' '));
const obscure=new Set('ad ag bb bz bj bt bf bi cv cf km cg dj dm gq er sz fj ga gm gd gw gy ht ls lr li mg mw mv ml mt mh mr mu fm mc na nr ni ne kn lc vc ws sm st sc sl sb ss sr tj tl tg to tm tv vu'.split(' '));
await fs.mkdir('public/media/flags',{recursive:true});
let cursor=0;const flags=[];
await Promise.all(Array.from({length:8},async()=>{while(cursor<codes.length){const iso=codes[cursor++],url=iso==='af'?'https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_the_Taliban.svg':`https://flagcdn.com/${iso}.svg`;const name=overrides[iso]??names.of(iso.toUpperCase());const id=crypto.createHash('sha256').update(`geoduel-flag-v2:${iso}`).digest('hex').slice(0,20),svg=`/media/flags/${id}.svg`;let bytes;try{bytes=await fs.readFile(`public${svg}`);}catch{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`${iso}: ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());await fs.writeFile(`public${svg}`,bytes);}
const text=bytes.toString();if(!text.includes('<svg')||/<script|<foreignObject|<image\b|\b(?:href|src)="https?:/i.test(text))throw Error(`Unsafe SVG: ${iso}`);
const view=text.match(/<svg[^>]*viewBox="([^"]+)"/),width=text.match(/<svg[^>]*\bwidth="([\deE.+-]+)(?:px)?"/),height=text.match(/<svg[^>]*\bheight="([\deE.+-]+)(?:px)?"/);const vb=view?.[1].split(/[ ,]+/).map(Number);const ratio=width&&height?Number(width[1])/Number(height[1]):vb?vb[2]/vb[3]:NaN;if(!(ratio>0&&ratio<4))throw Error(`Ratio ${iso}`);
flags.push({questionIds:[1,2,3].map(d=>'flag-v2-'+crypto.createHash('sha256').update(`geoduel-question:${iso}:${d}`).digest('hex').slice(0,20)),iso:iso.toUpperCase(),name,svg,aspectRatio:ratio,familiarity:known.has(iso)?1:obscure.has(iso)?3:2,groups:groups.filter(g=>g.members.includes(iso)).map(g=>g.id),similar:preferred[iso]??[],excluded:excluded.filter(pair=>pair.includes(iso)).flat().filter(x=>x!==iso),source:url,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),reviewed:'2026-11-09'});
}}));
flags.sort((a,b)=>a.iso.localeCompare(b.iso));
for(const f of flags){if(!f.groups.length)throw Error(`Missing authored group ${f.iso}`);f.similar=f.similar.map(x=>x.toUpperCase());f.excluded=f.excluded.map(x=>x.toUpperCase());}
for(const g of groups)g.members=g.members.map(x=>x.toUpperCase());
await fs.writeFile('data/flags/registry.json',JSON.stringify(flags,null,2)+'\n');await fs.writeFile('data/flags/groups.json',JSON.stringify(groups,null,2)+'\n');console.log(`Imported ${flags.length} native-ratio SVGs`);
