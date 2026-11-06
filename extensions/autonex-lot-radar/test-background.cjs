"use strict";
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'background.js'),'utf8');
const url='https://bid.cars/en/lot/1-12345678/2021-Toyota-Camry';
function fixture(state={auth:{accessToken:'test-token',refreshToken:'test-refresh'}}, items=[]) {
  const calls={notices:[],fetches:[],alarms:[],closed:[],created:[]};const listeners={};let seq=20;
  const context=vm.createContext({URL,AbortSignal,console,setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout,
    fetch:async(url,init)=>{calls.fetches.push({url,init});const body=url.endsWith('/inbox')?items:url.endsWith('/lot-radar')?{watches:[],delivery:{email:'self@example.com'}}:url.endsWith('/browser')?{lease:new Date(Date.now()+100000).toISOString(),url:'https://bid.cars/en/search/results',known:[]}:{};return{ok:true,status:200,json:async()=>body};},
    chrome:{runtime:{id:'radar',getURL:f=>`chrome-extension://radar/${f}`,onInstalled:{addListener:f=>listeners.install=f},onStartup:{addListener:f=>listeners.start=f},onMessage:{addListener:f=>listeners.message=f}},
      alarms:{create:async(...a)=>calls.alarms.push(a),onAlarm:{addListener:f=>listeners.alarm=f}},
      action:{onClicked:{addListener(){}},setBadgeBackgroundColor:async()=>{},setBadgeText:async()=>{}},
      notifications:{create:async(id,data)=>calls.notices.push({id,data}),onClicked:{addListener:f=>listeners.click=f}},
      tabs:{create:async data=>{calls.created.push(data);return{id:++seq};},get:async()=>({status:'complete'}),sendMessage:async()=>({error:'BidCars təhlükəsizlik yoxlaması tələb edir.'}),remove:async id=>calls.closed.push(id),update:async()=>{}},
      storage:{local:{get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).map(k=>[k,state[k]])),set:async values=>Object.assign(state,values),remove:async keys=>(typeof keys==='string'?[keys]:keys).forEach(k=>delete state[k]),clear:async()=>Object.keys(state).forEach(k=>delete state[k])}},
    }});vm.runInContext(source,context);return{context,state,calls,listeners,message:(payload,sender={url:'chrome-extension://radar/dashboard.html'})=>new Promise(resolve=>listeners.message(payload,sender,resolve))};
}
test('Chrome startup and installation recreate the recurring alarm',async()=>{const f=fixture();f.listeners.install();f.listeners.start();await new Promise(setImmediate);assert.equal(f.calls.alarms.length,2);assert.equal(f.calls.alarms[0][1].periodInMinutes,.5);});
test('an alert is notified once even after worker restart; read alerts are quiet',async()=>{
  const item={id:'alert1',readAt:null,data:{url,title:'2021 Camry',engineCc:2500},watch:{name:'Toyota'}};
  const f=fixture(undefined,[item]);await f.context.inbox();await f.context.inbox();assert.equal(f.calls.notices.length,1);
  const restarted=fixture(f.state,[item]);await restarted.context.inbox();assert.equal(restarted.calls.notices.length,0);
  const read=fixture(undefined,[{...item,readAt:'2026-11-06'}]);await read.context.inbox();assert.equal(read.calls.notices.length,0);
});
test('foreign links cannot become desktop notifications or clicked navigation',async()=>{
  const f=fixture(undefined,[{id:'bad',data:{url:'https://evil.test/lot/1-2'},watch:{name:'x'}}]);await f.context.inbox();assert.equal(f.calls.notices.length,0);
  f.state.notificationLinks={bad:'https://evil.test'};await f.listeners.click('bad');assert.equal(f.calls.created.length,0);
});
test('website/content scripts cannot invoke privileged account or API operations',()=>{
  const f=fixture();let replied=false;const result=f.listeners.message({type:'CREATE',body:{}},{url:'https://bid.cars/en/'},()=>{replied=true;});assert.equal(result,false);assert.equal(replied,false);assert.equal(f.calls.fetches.length,0);
});
test('challenge stops browser mode, closes only the extension-owned tab and never reports a successful empty scan',async()=>{
  const f=fixture();f.state.browserMode=true;f.state.job={id:'watch',lease:new Date(Date.now()+100000).toISOString(),tabId:99,stage:'search',url:'https://bid.cars/en/search/results',known:[],lots:[],remaining:[]};
  await f.context.stepBrowser();assert.equal(f.state.browserMode,false);assert.equal(f.state.job,undefined);assert.deepEqual(f.calls.closed,[99]);
  const request=f.calls.fetches.find(c=>c.url.endsWith('/finish'));assert.match(JSON.parse(request.init.body).error,/yoxlama/);assert.equal(f.calls.notices[0].id,'radar-attention');
});
test('logout clears per-account notification history and does not stop server-side watches',async()=>{
  const f=fixture();f.state.shown=['old'];f.state.browserMode=true;await f.context.logout();assert.deepEqual(f.state,{});assert.equal(f.calls.fetches.some(c=>c.init.method==='DELETE'),false);
});
