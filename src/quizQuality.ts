import quality from '../data/question-pool/quiz-quality.json';
import type {Question} from './engine';

const retired = new Set(quality.retiredIds);
export const reviewedQuestions = quality.replacements as Question[];

export function excludeRetiredQuestions(questions: Question[]) {
 return questions.map(q => retired.has(q.id) ? {...q, enabled:false} : q);
}
