import registry from '../data/flags/registry.json';
import families from '../data/flags/groups.json';
import type {Question} from './engine';
export type FlagEntry=typeof registry[number];
export const flags=registry;
export const flagGroups=families;
const byCode=new Map(flags.map(f=>[f.iso,f]));
function hash(text:string){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function shuffled<T>(input:T[],seed:string){const a=[...input];let n=hash(seed);for(let i=a.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function flagSimilarity(a:FlagEntry,b:FlagEntry){
 if(a.iso===b.iso||a.excluded.includes(b.iso)||b.excluded.includes(a.iso))return -1;
 const shared=a.groups.filter(g=>b.groups.includes(g));
 // Rare, specific families outweigh broad regional families.
 return shared.reduce((sum,id)=>sum+30/(families.find(g=>g.id===id)!.members.length),0)+(a.similar.includes(b.iso)?10-a.similar.indexOf(b.iso):0);
}
export function flagAlternatives(flag:FlagEntry,challenge:1|2|3):FlagEntry[]{
 const ranked=flags.filter(f=>flagSimilarity(flag,f)>0).sort((a,b)=>flagSimilarity(flag,b)-flagSimilarity(flag,a)||a.iso.localeCompare(b.iso));
 if(ranked.length<3)throw Error(`Missing plausible alternatives: ${flag.iso}`);
 const indices=challenge===3?[0,1,2]:challenge===2?[0,1,3]:[0,3,5];
 const selected:FlagEntry[]=[];
 for(const index of indices){const candidate=ranked[Math.min(index,ranked.length-1)];if(!selected.includes(candidate))selected.push(candidate);}
 for(const f of ranked)if(selected.length<3&&!selected.includes(f))selected.push(f);
 return selected;
}
export function generateFlagQuestions():Question[]{
 return flags.flatMap(flag=>([1,2,3] as const).map(challenge=>{
 const options=shuffled([flag,...flagAlternatives(flag,challenge)],`${flag.iso}:${challenge}`).map(f=>f.name);
 const difficulty=Math.max(flag.familiarity,challenge);
 const groups=flag.groups.map(id=>families.find(g=>g.id===id)!.description);
 return {id:flag.questionIds[challenge-1],category:'flags',difficulty,prompt:'Zu welchem Land gehört diese Flagge?',options,correct:options.indexOf(flag.name),enabled:true,
 explanation:`Die Flagge gehört zu ${flag.name}. Erkennungsmerkmale: ${groups.slice(0,2).join('; ')}. Vergleiche die Reihenfolge der Farben, die Position der Symbole und die Proportionen.`,
 media:{type:'image',src:flag.svg,alt:'Abgebildete Staatsflagge in Originalproportionen',license:'Public Domain – Flagpedia / Wikimedia Commons'},
 provenance:{sources:[flag.source,'https://flagpedia.net/download'],subjectKey:`flag:${flag.iso}`,iso:flag.iso,challenge,confusions:flagAlternatives(flag,challenge).map(f=>f.iso)}
 } as Question;
 }));
}
export const flagQuestions=generateFlagQuestions();
const subjects=new Map(flagQuestions.map(q=>[q.id,`flag:${q.provenance.iso}`]));
export function questionSubject(question:Pick<Question,'id'|'category'|'options'|'correct'>){
 if(question.category!=='flags')return question.id;
 return subjects.get(question.id)??`flag:${flags.find(f=>f.name===question.options[question.correct])?.iso??question.id}`;
}
export function seenSubject(id:string){return subjects.get(id)??legacySubjects.get(id)??id;}
// Preserves the effect of old history without rewriting stored user data.
const legacyCodes='DE FR IT ES GB US CA BR JP AU SE NO FI PL GR PT CH AT TR MX AR CL PE CO MA EG KE TH VN NZ'.split(' ');
const legacySubjects=new Map(legacyCodes.map((iso,i)=>[`flags-${String(i+1).padStart(3,'0')}`,`flag:${iso}`]));
