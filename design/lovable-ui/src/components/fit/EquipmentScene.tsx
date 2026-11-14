import {useEffect,useRef} from 'react';

/** A small, procedural WebGL object. No model, texture, tracker or external renderer. */
export function EquipmentScene(){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const c=canvas.current;if(!c||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const gl=c.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});if(!gl)return;
  const vert=`attribute vec3 p;attribute vec3 n;uniform float t;uniform vec2 aspect;varying vec3 normal;varying vec3 pos;void main(){float a=t*.28;mat3 ry=mat3(cos(a),0.,-sin(a),0.,1.,0.,sin(a),0.,cos(a));float b=-.38;mat3 rz=mat3(cos(b),sin(b),0.,-sin(b),cos(b),0.,0.,0.,1.);vec3 v=rz*ry*p;normal=rz*ry*n;pos=v;float depth=4.6-v.z;gl_Position=vec4(v.xy*aspect*2.6/depth,0.,1.);}`;
  const frag=`precision mediump float;varying vec3 normal;varying vec3 pos;void main(){vec3 n=normalize(normal);float light=max(dot(n,normalize(vec3(-.4,.8,1.))),0.);float rim=pow(1.-abs(n.z),2.);vec3 metal=vec3(.08,.10,.10)+light*vec3(.32,.37,.34);metal+=rim*vec3(.33,.68,.08);float ring=step(.90,abs(pos.x))*step(abs(pos.x),1.12);metal+=ring*vec3(.35,.61,.08);gl_FragColor=vec4(metal,1.);}`;
  const shader=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('shader');}return s;};
  let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null,vs:WebGLShader|null=null,fs:WebGLShader|null=null,raf=0,visible=true,stopped=false;
  const data:number[]=[];
  const cylinder=(x0:number,x1:number,r:number)=>{const N=36;for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,points=[[x0,r*Math.cos(a),r*Math.sin(a)],[x1,r*Math.cos(a),r*Math.sin(a)],[x1,r*Math.cos(b),r*Math.sin(b)],[x0,r*Math.cos(b),r*Math.sin(b)]];for(const j of [0,1,2,0,2,3]){const p=points[j];data.push(...p,0,p[1]/r,p[2]/r);}for(const [x,sign] of [[x0,-1],[x1,1]])for(const p of [[x,0,0],[x,r*Math.cos(a),r*Math.sin(a)],[x,r*Math.cos(b),r*Math.sin(b)]])data.push(...p,sign,0,0);}};
  cylinder(-.95,.95,.105);for(const side of [-1,1]){cylinder(side*.75,side*1.05,.53);cylinder(side*1.05,side*1.20,.46);cylinder(side*1.20,side*1.29,.17);}
  const draw=(time:number)=>{raf=0;if(stopped||!visible||document.hidden||gl.isContextLost())return;const box=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(gl.getUniformLocation(program!,'t'),time/1000);gl.uniform2f(gl.getUniformLocation(program!,'aspect'),h/w,1);gl.drawArrays(gl.TRIANGLES,0,data.length/6);raf=requestAnimationFrame(draw);};
  const resume=()=>{if(visible&&!document.hidden&&!raf&&!stopped)raf=requestAnimationFrame(draw);};
  const lost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(raf);raf=0;c.style.opacity='0';};
  try{vs=shader(gl.VERTEX_SHADER,vert);fs=shader(gl.FRAGMENT_SHADER,frag);program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('program');gl.useProgram(program);buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);for(const [name,offset] of [['p',0],['n',12]] as const){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}gl.enable(gl.DEPTH_TEST);resume();}catch{c.style.opacity='0';}
  const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(!visible){cancelAnimationFrame(raf);raf=0;}else resume();}):null;observer?.observe(c);document.addEventListener('visibilitychange',resume);c.addEventListener('webglcontextlost',lost);
  return()=>{stopped=true;cancelAnimationFrame(raf);observer?.disconnect();document.removeEventListener('visibilitychange',resume);c.removeEventListener('webglcontextlost',lost);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);};
 },[]);
 return <canvas ref={canvas} className="sf-equipment-canvas" aria-hidden="true"/>;
}
