import capitals from '../data/question-pool/capitals.json';
import silhouettes from '../data/question-pool/silhouettes.json';
import maps from '../data/question-pool/maps.json';
import borders from '../data/question-pool/borders.json';
import landmarks from '../data/question-pool/landmarks.json';
import world from '../data/question-pool/world.json';
import type {Question} from './engine';
export const expandedQuestions=[...capitals,...silhouettes,...maps,...borders,...landmarks,...world] as Question[];
export const expandedSubjects=new Map(expandedQuestions.map(q=>[q.id,q.provenance.subjectKey!]));
