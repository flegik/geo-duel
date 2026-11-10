// Bounds from the shared local atlas paths: no second geometry database.
export function mapViewport(paths:string[]){
 const points=paths.flatMap(p=>[...p.matchAll(/(?:M|L)(-?[\d.]+),(-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]));
 if(!points.length)return {viewBox:'0 0 720 360',x:360,y:180,width:720,tiny:false};
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const sorted=[...new Set(xs)].sort((a,b)=>a-b);
 let gap=-1,start=sorted[0];
 sorted.forEach((x,i)=>{const next=sorted[(i+1)%sorted.length];const d=(next-x+720)%720;if(d>gap){gap=d;start=next;}});
 const wrapped=xs.map(x=>x<start?x+720:x);
 const minX=Math.min(...wrapped),maxX=Math.max(...wrapped),minY=Math.min(...ys),maxY=Math.max(...ys);
 if(maxX-minX>500)return {viewBox:'0 0 720 360',x:360,y:180,width:720,tiny:false};
 const x=(minX+maxX)/2,y=(minY+maxY)/2;
 const width=Math.min(720,Math.max(16,(maxX-minX)*1.6,(maxY-minY)*2.8));const height=width/1.7;
 return {viewBox:`${x-width/2} ${y-height/2} ${width} ${height}`,x,y,width,tiny:maxX-minX<.4&&maxY-minY<.4};
}
