import type {Point} from './mapViewport';

const scale=Math.cos(51*Math.PI/180);
export const projectGermanyPoint=([lon,lat]:readonly number[]):Point=>[(lon-5.5)*100*scale,(55.1-lat)*100];
