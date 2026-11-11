import {createClient} from '@supabase/supabase-js';
import type {Category} from './engine';
import type {QuestionMediaData} from './QuestionMedia';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
export type Player={id:string;nickname:string;ready:boolean;finished:boolean;progress:number};
export type MatchResult={id:string;date:string;total:number;categories:Category[];players:{id:string;nickname:string;points:number;correct:number;categories:Partial<Record<Category,number>>}[]};
export type DuelReviewAnswer={profileId:string;selected:number;points:number};
export type DuelReviewQuestion={
 position:number;category:Category;prompt:string;options:string[];correct:number;
 media:QuestionMediaData|null;explanation:string;provenance?:{sources:string[]}|null;
 answers:DuelReviewAnswer[];
};
export type Room={id:string;code:string;host:string;status:'waiting'|'playing'|'completed'|'aborted';perCategory:2|3|4;selectedCategories?:Category[]|null;categories:Category[];total:number;cursor:number;finished:boolean;rematchId?:string;points:number;players:Player[];question?:{id:string;category:Category;difficulty:number;prompt:string;options:string[];media:null|{src:string;alt:string;license:string;type?:string}};feedback?:{selected:number;correct:number;points:number;explanation:string;provenance:{sources:string[]}};result?:MatchResult};
export type DuelStats={played:number;wins:number;losses:number;draws:number;points:number;correct:number;answers:number;history:{id:string;date:string;total:number;me:MatchResult['players'][0];opponent:MatchResult['players'][0]}[];categories:{category:Category;total:number;correct:number;points:number}[]};
export async function rpc<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
 if(!supabase)throw Error('Der Duellserver ist noch nicht konfiguriert. Singleplayer ist verfügbar.');
 const {data,error}=action==='join'||action==='create'?await supabase.functions.invoke('game',{body:{action,payload}}):await supabase.rpc('geoduel',{action,payload});
 if(error)throw Error('Die Verbindung zum Spielserver ist unterbrochen. Bitte versuche es erneut.');
 if(data?.error)throw Error(data.error);
 return data as T;
}
let identityPromise:Promise<{id:string;nickname:string}>|null=null;
export function connectGuest(nickname:string){
 if(identityPromise)return identityPromise;
 identityPromise=(async()=>{
 if(!supabase)throw Error('Der Duellserver ist noch nicht konfiguriert.');
 const {data:{session}}=await supabase.auth.getSession();let id=session?.user.id;
 if(!id){const {data,error}=await supabase.auth.signInAnonymously();if(error||!data.user)throw Error('Gastzugang derzeit nicht möglich. Bitte prüfe die Verbindung.');id=data.user.id;}
 const profile=await rpc<{id:string;nickname:string}>('profile',{nickname});return {...profile,id};
 })().finally(()=>{identityPromise=null;});return identityPromise;
}
