import {categories,type Category} from './engine';
import type {Room} from './api';

export const duelCategories=Object.keys(categories) as Category[];
export const minDuelQuestions=4;
export const maxDuelQuestions=24;
export type QuestionCounts=Partial<Record<Category,number>>;
export type DuelConfigUpdate={questionCounts:QuestionCounts}|{randomCategories:true;perCategory:2|3|4};
export const countQuestions=(counts:QuestionCounts)=>duelCategories.reduce((total,category)=>total+(counts[category]??0),0);
export const validDuelLength=(total:number)=>total>=minDuelQuestions&&total<=maxDuelQuestions;

export function duelDistribution(room:Pick<Room,'questionCounts'|'playedCounts'|'selectedCategories'|'categories'|'perCategory'|'status'>):QuestionCounts|null{
 if(room.playedCounts!=null)return room.playedCounts;
 if(room.questionCounts!=null)return room.questionCounts;
 const configured=room.status==='waiting'?room.selectedCategories:room.categories?.length?room.categories:room.selectedCategories;
 return configured?.length?Object.fromEntries(configured.map(category=>[category,room.perCategory])):null;
}

export function adjustQuestionCount(counts:QuestionCounts,category:Category,delta:-1|1):QuestionCounts{
 const previous=counts[category]??0;
 if((delta<0&&previous===0)||(delta>0&&countQuestions(counts)>=maxDuelQuestions))return counts;
 const next={...counts};
 const value=previous+delta;
 if(value)next[category]=value;
 else delete next[category];
 return next;
}
