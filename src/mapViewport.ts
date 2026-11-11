export type Point=[number,number];
export function pathPoints(path:string):Point[]{return [...path.matchAll(/(?:M|L)(-?[\d.]+),(-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);}
const nearX=(x:number,center:number)=>center+((x-center+1080)%720)-360;
function bounds(points:Point[]){
 const xs=[...new Set(points.map(p=>p[0]))].sort((a,b)=>a-b);let gap=-1,start=xs[0];
 xs.forEach((x,i)=>{const next=xs[(i+1)%xs.length],d=(next-x+720)%720;if(d>gap){gap=d;start=next;}});
 const shifted=points.map(([x,y])=>[x<start?x+720:x,y] as Point);
 const x0=Math.min(...shifted.map(p=>p[0])),x1=Math.max(...shifted.map(p=>p[0])),y0=Math.min(...shifted.map(p=>p[1])),y1=Math.max(...shifted.map(p=>p[1]));
 return {x0,x1,y0,y1,x:(x0+x1)/2,y:(y0+y1)/2};
}
function camera(points:Point[],local=false){
 const b=bounds(points),latitude=90-b.y/2,scaleX=Math.max(.25,Math.cos(latitude*Math.PI/180));
 const rawWidth=(b.x1-b.x0)*scaleX,rawHeight=b.y1-b.y0;
 const aspect=rawHeight>rawWidth*1.5?.9:1.6;
 const width=Math.max(local?.004:16*scaleX,rawWidth*1.65,rawHeight*aspect*1.65);
 const height=width/aspect,x=b.x*scaleX,y=b.y;
 const centerY=Math.max(height/2,Math.min(360-height/2,y));
 return {viewBox:`${x-width/2} ${centerY-height/2} ${width} ${height}`,x,y,width,height,scaleX,aspect,tiny:Math.max(rawWidth,rawHeight)<width*.035,sourceX:b.x,sourceWidth:width/scaleX};
}
// Separate remote land parts rather than fitting a country's full global extent.
// Every camera uses the original shared atlas coordinates; no country is stretched to fit.
export function regionalViews(paths:string[]){
 const pieces=paths.flatMap(path=>(path.match(/M[^M]+/g)??[]).map(r=>{
  const points=pathPoints(r),b=bounds(points);let area=0;
  const shifted=points.map(([x,y])=>[nearX(x,b.x),y]);
  for(let i=1;i<shifted.length;i++)area+=shifted[i-1][0]*shifted[i][1]-shifted[i][0]*shifted[i-1][1];
  return {points,b,area:Math.abs(area)*Math.max(.25,Math.cos((90-b.y/2)*Math.PI/180))};
 })).filter(p=>p.points.length>=4).sort((a,b)=>b.area-a.area);
 if(!pieces.length)return [];
 const groups:typeof pieces[]=[];
 for(const piece of pieces){
  const group=groups.find(g=>{const a=g[0].b,cos=Math.max(.25,Math.cos((90-a.y/2)*Math.PI/180));return Math.abs((nearX(piece.b.x,a.x)-a.x)*cos)<Math.max(12,(a.x1-a.x0)*cos*.85)&&Math.abs(piece.b.y-a.y)<Math.max(12,(a.y1-a.y0)*.85);});
  if(group)group.push(piece);else groups.push([piece]);
 }
 // Microscopic offshore fragments do not create dozens of navigation buttons.
 return groups.filter((g,i)=>i===0||g.reduce((n,p)=>n+p.area,0)>pieces[0].area*.001).map(g=>{
  const points=g.flatMap(p=>p.points),view=camera(points);
  const core=camera(g[0].points,true);
  const needsDetail=view.tiny||Math.max((g[0].b.x1-g[0].b.x0)*view.scaleX,g[0].b.y1-g[0].b.y0)<Math.max(view.width,view.height)*.16;
  return {...view,detail:needsDetail?core:null};
 });
}
export function mapViewport(paths:string[]){return regionalViews(paths)[0]??{viewBox:'0 0 16 10',x:8,y:5,width:16,height:10,scaleX:1,aspect:1.6,tiny:false,sourceX:8,sourceWidth:16,detail:null};}

export function pointMapViewport(points:Point[]){return camera(points);}
