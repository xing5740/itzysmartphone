// Exercise the two storage backends and queued transactions without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const KEY='itzy-phone-save-v1';
const source=readFileSync(new URL('../js/storage.js',import.meta.url),'utf8').replace(/^export /gm,'')+'\nglobalThis.storage={openStorage,saveState,resetStorage};';
const fresh=()=>({version:1,posts:[],stories:[],chats:{instagram:{}},events:{},jobs:[]});
const old=()=>({...fresh(),posts:[{id:'old-instagram-post'}],stories:[{id:'old-story'}],jobs:[{id:'old-dm'}]});
function environment() {
  const e={idbAvailable:true,localAvailable:true,failWrites:false,holdWrites:false,disk:new Map(),fallback:new Map(),pending:[],writes:0};
  e.localStorage={getItem(key){if(!e.localAvailable)throw new Error('blocked');return e.fallback.get(key)??null;},setItem(key,value){if(!e.localAvailable)throw new Error('blocked');e.fallback.set(key,value);},removeItem(key){if(!e.localAvailable)throw new Error('blocked');e.fallback.delete(key);}};
  const database={transaction(){const tx={objectStore(){return {get(key){const request={};queueMicrotask(()=>{request.result=structuredClone(e.disk.get(key));request.onsuccess();});return request;},put(value,key){e.writes++;const finish=()=>{if(e.failWrites){tx.error=new Error('write failed');tx.onerror();}else{e.disk.set(key,structuredClone(value));tx.oncomplete();}};if(e.holdWrites)e.pending.push(finish);else queueMicrotask(finish);}};}};return tx;}};
  e.indexedDB={open(){if(!e.idbAvailable)throw new Error('blocked');const request={};queueMicrotask(()=>{request.result=database;request.onsuccess();});return request;}};
  e.tab=()=>{const context=vm.createContext({indexedDB:e.indexedDB,localStorage:e.localStorage,structuredClone,crypto:webcrypto});vm.runInContext(source,context);return context.storage;};
  e.disk.set(KEY,old());e.fallback.set(KEY,JSON.stringify(old()));return e;
}

test('reset replaces both IndexedDB and fallback Instagram data; fallback reload stays empty',async()=>{
  const e=environment(),tab=e.tab();assert.equal((await tab.openStorage()).posts.length,1);
  await tab.resetStorage(fresh());
  for(const value of [e.disk.get(KEY),JSON.parse(e.fallback.get(KEY))]){assert.equal(value.posts.length,0);assert.equal(value.jobs.length,0);assert.equal(value.stories.length,0);}
  e.idbAvailable=false;assert.equal((await e.tab().openStorage()).posts.length,0);
});

test('reset in fallback mode rejects stale IndexedDB data when that backend returns',async()=>{
  const e=environment();e.idbAvailable=false;const tab=e.tab();await tab.openStorage();await tab.resetStorage(fresh());
  assert.equal(e.disk.get(KEY).posts.length,1);
  e.idbAvailable=true;const reloaded=e.tab(),state=await reloaded.openStorage();assert.equal(state.posts.length,0);
  await reloaded.saveState(state);assert.equal(e.disk.get(KEY).posts.length,0);
});

test('queued pre-reset saves cannot overwrite the reset snapshot',async()=>{
  const e=environment(),tab=e.tab();await tab.openStorage();e.holdWrites=true;
  const first=tab.saveState(old());await new Promise(resolve=>setImmediate(resolve));assert.equal(e.pending.length,1);
  const queued=tab.saveState(old()),reset=tab.resetStorage(fresh());
  e.holdWrites=false;e.pending.shift()();await Promise.all([first,queued,reset]);
  assert.equal(e.writes,2);assert.equal(e.disk.get(KEY).posts.length,0);assert.equal(JSON.parse(e.fallback.get(KEY)).posts.length,0);
});

test('an older tab cannot write its Instagram state back after another tab resets',async()=>{
  const e=environment(),first=e.tab(),second=e.tab();const stale=await first.openStorage();await second.openStorage();
  await second.resetStorage(fresh());await first.saveState(stale);
  assert.equal(e.disk.get(KEY).posts.length,0);
  e.idbAvailable=false;await first.saveState(stale);assert.equal((await e.tab().openStorage()).posts.length,0);
});

test('reset still succeeds with IndexedDB when localStorage is unavailable',async()=>{
  const e=environment();e.localAvailable=false;const tab=e.tab();await tab.openStorage();await tab.resetStorage(fresh());
  assert.equal((await e.tab().openStorage()).posts.length,0);
});

test('failed reset reports failure and retains the last readable save',async()=>{
  const e=environment(),tab=e.tab();await tab.openStorage();e.localAvailable=false;e.failWrites=true;
  await assert.rejects(tab.resetStorage(fresh()));e.localAvailable=true;e.failWrites=false;
  assert.equal((await e.tab().openStorage()).posts.length,1);
});
