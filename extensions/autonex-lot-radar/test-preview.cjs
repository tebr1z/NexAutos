// Local visual QA only. This server is not included in the installable ZIP.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const fixture={watches:[{id:'qa',name:'Camry 2.5 · ön zədə',enabled:true,filters:{make:'Toyota',model:'Camry',yearFrom:2020,yearTo:2026,engineMin:2400,engineMax:2600,damages:['front','right'],document:'salvage'},initializedAt:'2026-11-06T08:00:00Z',checkedAt:'2026-11-06T10:10:00Z',searchUrl:'https://bid.cars/en/'}],items:[{id:'qa-lot',watch:{name:'Camry 2.5 · ön zədə'},createdAt:'2026-11-06T10:10:00Z',emailError:'not_configured',data:{title:'2022 Toyota Camry, SE',url:'https://bid.cars/en/lot/1-12345678/2022-Toyota-Camry',engineCc:2500,primaryDamage:'Front end',secondaryDamage:'Right rear',document:'Salvage certificate (CA)',documentKind:'salvage'}}],delivery:{email:'qa@example.com',phone:null,emailReady:false,whatsappReady:false,serverMonitoring:false},browserMode:false};
const allowed=new Set(['dashboard.html','dashboard.css','dashboard.js','icons/icon16.png','icons/icon48.png','icons/icon128.png']);
http.createServer((req,res)=>{
  const file=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'dashboard.html';
  if(file==='qa-runtime.js'){res.setHeader('Content-Type','application/javascript');return res.end(`document.title='QA fixture · Lot Radar'; const banner=document.createElement('div');banner.textContent='YALNIZ DİZAYN TESTİ · Nümunə məlumat · Real mesaj göndərilmir';banner.style.cssText='padding:8px;text-align:center;background:#613b0a;color:white';document.body.prepend(banner);globalThis.chrome={runtime:{sendMessage:async m=>({ok:true,data:${JSON.stringify(fixture)}})}};`);}
  if(!allowed.has(file)){res.writeHead(404);return res.end();}
  let body=fs.readFileSync(path.join(__dirname,file));
  if(file.endsWith('.html')){body=body.toString().replace('<script src="dashboard.js">','<script src="qa-runtime.js"></script><script src="dashboard.js">');res.setHeader('Content-Type','text/html; charset=utf-8');}
  else res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'image/png');
  res.end(body);
}).listen(3104,'127.0.0.1',()=>console.log('QA preview: http://127.0.0.1:3104'));
