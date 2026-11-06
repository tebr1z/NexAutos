"use strict";
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'background.js'),'utf8');
const url='https://bid.cars/en/lot/1-12345678/2021-Toyota-Camry';
function fixture(state={auth:{accessToken:'test-token',refreshToken:'test-refresh'}}, items=[], options={}) {
  const calls={notices:[],fetches:[],alarms:[],closed:[],created:[],updated:[],snapshots:[]};const listeners={};let seq=20;
  const context=vm.createContext({URL,AbortSignal,console,setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout,
    fetch:async(url,init)=>{calls.fetches.push({url,init});const fallback=url.endsWith('/inbox')?items:url.endsWith('/lot-radar')?{watches:[],delivery:{email:'self@example.com'}}:url.endsWith('/browser')?{lease:new Date(Date.now()+100000).toISOString(),url:'https://bid.cars/en/search/results',known:[]}:{};const body=options.response?await options.response(url,init,fallback):fallback;return{ok:true,status:200,json:async()=>body};},
    chrome:{runtime:{id:'radar',getURL:f=>`chrome-extension://radar/${f}`,onInstalled:{addListener:f=>listeners.install=f},onStartup:{addListener:f=>listeners.start=f},onMessage:{addListener:f=>listeners.message=f}},
      alarms:{create:async(...a)=>calls.alarms.push(a),onAlarm:{addListener:f=>listeners.alarm=f}},
      action:{onClicked:{addListener(){}},setBadgeBackgroundColor:async()=>{},setBadgeText:async()=>{}},
      notifications:{create:async(id,data)=>calls.notices.push({id,data}),onClicked:{addListener:f=>listeners.click=f}},
      tabs:{create:async data=>{calls.created.push(data);return{id:++seq};},get:async()=>({status:'complete'}),sendMessage:async(id,message)=>{calls.snapshots.push({id,message});return options.snapshot?options.snapshot(id,message,calls.snapshots.length):{error:'BidCars təhlükəsizlik yoxlaması tələb edir.'};},remove:async id=>calls.closed.push(id),update:async(id,data)=>calls.updated.push({id,...data})},
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

test('automatic scans require twenty minutes, any server due date, and no live lease',()=>{
  const f=fixture();const now=Date.now();const watch={id:'watch',enabled:true,checkedAt:new Date(now-19*60000).toISOString()};
  assert.equal(f.context.scanDue(watch,{},now),false);
  watch.checkedAt=new Date(now-20*60000).toISOString();assert.equal(f.context.scanDue(watch,{},now),true);
  assert.equal(f.context.scanDue(watch,{watch:now+1},now),false);
  watch.nextCheckAt=new Date(now+1).toISOString();assert.equal(f.context.scanDue(watch,{},now),false);
  delete watch.nextCheckAt;watch.leaseUntil=new Date(now+60000).toISOString();assert.equal(f.context.scanDue(watch,{},now),false);
  watch.leaseUntil=null;watch.enabled=false;assert.equal(f.context.scanDue(watch,{},now),false);
});

test('Buy Now price refresh rereads known lots and reports only snapshots through its own tab',async()=>{
  const state={auth:{accessToken:'t',refreshToken:'r'},browserMode:true,job:{id:'watch',lease:new Date(Date.now()+100000).toISOString(),tabId:99,stage:'search',url:'https://bid.cars/en/search/results',known:['1-12345678'],refreshKnown:true,lots:[],remaining:[]}};
  const f=fixture(state,[],{snapshot:(id,message,index)=>index===1?{url:state.job.url,links:[url,url]}:{url,html:'<h1>2021 Toyota Camry</h1><p>Buy Now: $4,500 USD</p>'}});
  const before=Date.now();await f.context.stepBrowser();
  const finish=JSON.parse(f.calls.fetches.find(c=>c.url.endsWith('/finish')).init.body);assert.equal(finish.lots.length,1);assert.match(finish.lots[0].html,/4,500/);
  assert.deepEqual(f.calls.closed,[99]);assert.deepEqual(f.calls.updated.map(c=>c.url),[url]);assert.equal(f.state.job,undefined);
  assert.ok(f.state.browserDue.watch>=before+20*60000);assert.ok(f.state.lastBrowserAt);
});

test('empty JavaScript shells are retried and never become successful empty inventory',async()=>{
  const f=fixture(undefined,[],{snapshot:()=>({url:'https://bid.cars/en/search/results',links:[],pending:true})});
  await assert.rejects(()=>f.context.readTab(99,'https://bid.cars/en/search/results'),/25 saniyədə/);assert.equal(f.calls.snapshots.length,25);
});

test('readTab waits for requested filters and does not read another search or foreign origin',async()=>{
  const f=fixture(undefined,[],{snapshot:()=>({url:'https://bid.cars/en/search/results?make=Ford',links:[url]})});
  await assert.rejects(()=>f.context.readTab(99,'https://bid.cars/en/search/results?make=Toyota'),/25 saniyədə/);
  const other=fixture(undefined,[],{snapshot:()=>({url:'https://evil.test/en/search/results',empty:true,links:[]})});
  await assert.rejects(()=>other.context.readTab(99,'https://bid.cars/en/search/results'),/25 saniyədə/);
});

test('customers cannot enable the admin collector or request other customers jobs',async()=>{
  const f=fixture({auth:{accessToken:'t',refreshToken:'r',user:{role:'CUSTOMER'}}});
  const response=await f.message({type:'COLLECTOR_MODE',enabled:true});assert.equal(response.ok,false);assert.match(response.error,/yalnız ADMIN/);assert.equal(f.state.collectorMode,undefined);
  await assert.rejects(()=>f.context.startCollector(f.state.auth),/yalnız ADMIN/);assert.equal(f.calls.fetches.length,0);
});

test('collector jobs survive worker restart and finish through admin endpoint',async()=>{
  const admin={accessToken:'t',refreshToken:'r',user:{role:'ADMIN'}};
  const f=fixture({auth:admin,browserMode:true,collectorMode:true},[],{response:(endpoint,init,fallback)=>endpoint.endsWith('/collector/next')?{job:{id:'other-customer-watch',lease:new Date(Date.now()+100000).toISOString(),url:'https://bid.cars/en/search/results',known:[],refreshKnown:true}}:fallback});
  await f.context.startCollector(admin);assert.equal(f.state.job.collector,true);assert.equal(f.calls.created.length,1);assert.equal(f.calls.created[0].active,false);
  const restarted=fixture(f.state,[],{snapshot:()=>({url:'https://bid.cars/en/search/results',links:[],empty:true})});await restarted.context.stepBrowser();
  assert.ok(restarted.calls.fetches.some(c=>c.url.endsWith('/admin/collector/other-customer-watch/finish')));assert.deepEqual(restarted.calls.closed,[21]);assert.equal(restarted.state.job,undefined);
});

test('collector challenge uses admin failure endpoint and pauses both automatic modes',async()=>{
  const f=fixture({auth:{accessToken:'t',refreshToken:'r',user:{role:'ADMIN'}},browserMode:true,collectorMode:true,job:{id:'other-watch',collector:true,lease:new Date(Date.now()+100000).toISOString(),tabId:45,stage:'search',url:'https://bid.cars/en/search/results',known:[],lots:[],remaining:[]}});
  await f.context.stepBrowser();assert.equal(f.state.browserMode,false);assert.equal(f.state.collectorMode,false);assert.ok(f.calls.fetches.some(c=>c.url.endsWith('/admin/collector/other-watch/finish')));assert.deepEqual(f.calls.closed,[45]);
});

test('notification includes explicit Buy Now USD price',async()=>{
  const f=fixture(undefined,[{id:'cheap',data:{url,title:'2021 Toyota Camry',buyNowUsd:4500},watch:{name:'Camry ucuz',filters:{mode:'buy_now'}}}]);await f.context.inbox();assert.match(f.calls.notices[0].data.title,/Buy Now fürsəti/);assert.match(f.calls.notices[0].data.message,/Buy Now: \$4,500 USD/);
});
