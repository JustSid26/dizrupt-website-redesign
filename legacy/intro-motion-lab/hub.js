const canvas = document.querySelector('.ambient');
const ctx = canvas.getContext('2d');
let points = [], width = 0, height = 0, dpr = 1, seed = 4431;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
function resize(){width=innerWidth;height=Math.max(innerHeight,document.documentElement.scrollHeight);dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);points=Array.from({length:Math.min(600,Math.round(width*.5))},()=>({x:random()*width,y:random()*height,r:.3+random()*1.1,a:.025+random()*.1,p:random()*6.28}))}
function frame(t){ctx.clearRect(0,0,width,height);for(const p of points){ctx.fillStyle=`rgba(155,207,244,${p.a})`;ctx.beginPath();ctx.arc(p.x+Math.sin(t*.00008+p.p)*8,p.y+Math.cos(t*.00006+p.p)*5,p.r,0,6.28);ctx.fill()}requestAnimationFrame(frame)}
addEventListener('resize',resize);resize();requestAnimationFrame(frame);
