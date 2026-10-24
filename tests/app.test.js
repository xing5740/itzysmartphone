// 在最小 DOM 測試替身上驗證畫面狀態與事件接線；不取代真實瀏覽器視覺驗證。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&#39;',"'").replaceAll('&amp;','&');
async function appFixture({onboard=true,stored=null}={}) {
  const elements=new Map(),listeners={};
  let document;
  class Element {
    constructor(id='',owner=null){this.id=id;this.owner=owner;this._html='';this.value='';this.dataset={};this.style={};this.tagName='DIV';this.scrollTop=0;this.scrollHeight=500;this.classList={toggle:()=>{},add:()=>{},remove:()=>{}};this.listeners={};}
    set innerHTML(html){this._html=html;for(const [id,node] of elements)if(node.owner===this)elements.delete(id);for(const match of html.matchAll(/<(input|textarea|form|div|span|button|select|p)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Element(match[2],this);node.tagName=match[1].toUpperCase();const value=match[0].match(/\bvalue="([^"]*)"/);if(value)node.value=decode(value[1]);if(node.tagName==='TEXTAREA'){const content=html.slice(match.index+match[0].length).split('</textarea>')[0];node.value=decode(content);}elements.set(node.id,node);}}
    get innerHTML(){return this._html;}
    querySelector(selector){if(selector.startsWith('#'))return elements.get(selector.slice(1))||null;if(selector==='.scroll'||selector==='.sheet-scroll')return new Element('',this);if(selector.includes('input'))return [...elements.values()].find(x=>x.owner===this&&x.tagName==='INPUT')||null;return null;}
    querySelectorAll(){return [];}
    contains(el){return el?.owner===this;}
    focus(){document.activeElement=this;}
    setSelectionRange(){}
    setAttribute(){}
    addEventListener(type,handler){this.listeners[type]=handler;}
    matches(){return false;}
  }
  for(const id of ['app','overlay','screen','status-bar','status-time','toast','home-button','image-upload','signal','wifi'])elements.set(id,new Element(id));
  document={activeElement:null,querySelector:s=>elements.get(s.slice(1))||null,getElementById:id=>elements.get(id)||null,addEventListener:(type,handler)=>(listeners[type]??=[]).push(handler),createElement:()=>new Element()};
  const saved=new Map(stored?[['itzy-phone-save-v1',JSON.stringify(stored)]]:[]);const intervals=[];
  const context=vm.createContext({window:{},document,console,crypto:webcrypto,structuredClone,Date,Intl,Math,JSON,Map,Set,Blob,URL,HTMLImageElement:class{},setInterval:handler=>(intervals.push(handler),intervals.length),clearInterval(){},setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame:fn=>fn(),localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)}});
  let source=read('js/config.js')+'\n';
  for(const name of ['core','storage','icons','app'])source+=read(`js/${name}.js`).replace(/^import .+;\n/gm,'').replace(/^export /gm,'')+'\n';
  source+='globalThis.fixture={get state(){return state},get route(){return route},get modal(){return modal},get photos(){return photos},runDueJobs,refresh,renderModal,createState,C};';
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  function click(action,data={}){const target={dataset:{action,...data},disabled:false,closest:selector=>selector==='[data-action]'?target:null};for(const handler of listeners.click||[])handler({target});}
  function submit(id){for(const handler of listeners.submit||[])handler({target:{id},preventDefault(){}});}
  function input(id,value){const target=elements.get(id);target.value=value;for(const handler of listeners.input||[])handler({target});}
  if(onboard&&!context.fixture.state.onboardingComplete){input('setup-username','seoyeon.zip');input('setup-nickname','서연');submit('setup-form');}
  return {context,elements,click,submit,input,saved,fixture:context.fixture,root:elements.get('app'),overlay:elements.get('overlay')};
}

test('UI wiring unlocks, opens all apps, and supports independent KakaoTalk conversations',async()=>{
  const a=await appFixture();assert.match(a.root.innerHTML,/鎖定畫面/);a.click('unlock');assert.equal(a.fixture.route.app,'home');assert.match(a.root.innerHTML,/首爾/);
  a.click('app',{app:'kakao'});assert.match(a.root.innerHTML,/Yeji/);a.click('open-chat',{channel:'kakao',member:'yeji'});a.elements.get('chat-input').value='今天一起吃飯？';a.submit('chat-form');assert.equal(a.fixture.state.chats.kakao.yeji.at(-1).text,'今天一起吃飯？');assert.equal(a.fixture.state.chats.kakao.yeji.at(-1).sender,'me');assert.equal(a.fixture.state.jobs.length,0);
  a.click('open-chat',{channel:'kakao',member:'lia'});assert.doesNotMatch(a.root.innerHTML,/今天一起吃飯？/);
  for(const name of ['instagram','photos','phone','sms']){a.click('app',{app:name});assert.equal(a.fixture.route.app,name);assert.ok(a.root.innerHTML.length>100);}
});
test('UI publishes multiple photos, navigates slides, comments, shares a post and shows own profile',async()=>{
  const a=await appFixture();a.click('unlock');a.click('compose');a.click('select-photo',{member:'yeji'});a.click('select-photo',{member:'lia'});a.elements.get('compose-caption').value='<script>alert(1)</script> 日常';a.click('publish');assert.equal(a.fixture.state.posts.length,1);const p=a.fixture.state.posts[0];assert.equal(p.images.length,2);assert.match(a.root.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(a.root.innerHTML,/<script>alert/);
  a.click('slide',{id:p.id,dir:'1'});assert.equal(p.slide,1);a.click('like',{id:p.id});assert.equal(p.likes,1);a.click('bookmark',{id:p.id});assert.equal(a.fixture.state.bookmarked[0],p.id);
  a.click('comments',{id:p.id});a.elements.get('comment-input').value='喜歡這一天';a.submit('comment-form');assert.equal(p.comments[0].text,'喜歡這一天');assert.match(a.overlay.innerHTML,/喜歡這一天/);
  a.click('close-modal');a.click('share-post',{id:p.id});a.click('send-post',{id:p.id,member:'ryujin'});assert.equal(a.fixture.state.chats.instagram.ryujin.at(-1).postId,p.id);assert.match(a.root.innerHTML,/dm-shared-post/);
  a.click('ig-tab',{tab:'profile'});assert.match(a.root.innerHTML,/profile-grid/);assert.match(a.root.innerHTML,/seoyeon.zip/);
});
test('UI photo sharing and story publication preserve the selected pairing',async()=>{
  const a=await appFixture();a.click('photo',{member:'yuna'});assert.match(a.root.innerHTML,/[1-7]天前/);assert.match(a.root.innerHTML,/加入說明/);a.click('photo-share',{member:'yuna'});a.click('photo-to-compose',{member:'yuna',type:'story'});assert.equal(a.fixture.modal.images[0].member,'yuna');a.click('publish');assert.equal(a.fixture.state.stories.at(-1).author,'me');assert.equal(a.fixture.state.events.yuna.phase,'queued');
  a.click('story',{member:'me'});assert.match(a.overlay.innerHTML,/story-viewer/);a.click('story-next');assert.equal(a.fixture.modal,null);
});

test('first launch requires a valid ID and nickname before entering the phone',async()=>{
  const a=await appFixture({onboard:false});
  assert.equal(a.fixture.route.app,'setup');a.click('unlock');assert.equal(a.fixture.route.app,'setup');
  a.elements.get('home-button').listeners.click();assert.equal(a.fixture.route.app,'setup');
  a.input('setup-username','bad name');a.input('setup-nickname','小雨');a.submit('setup-form');assert.equal(a.fixture.state.onboardingComplete,false);assert.match(a.elements.get('setup-error').textContent,/Instagram ID/);
  a.input('setup-username','@rain.zip');a.submit('setup-form');assert.equal(a.fixture.state.onboardingComplete,true);assert.equal(a.fixture.state.profile.nickname,'小雨');assert.equal(a.fixture.state.profile.username,'rain.zip');assert.equal(a.fixture.route.app,'lock');assert.match(a.root.innerHTML,/小雨/);
  a.click('open-chat',{channel:'kakao',member:'yeji'});assert.match(a.root.innerHTML,/小雨，今天/);assert.doesNotMatch(a.root.innerHTML,/\{\{nickname\}\}/);
});

test('photo dates stay sorted, previous/next follow that order, and captions survive reload',async()=>{
  const a=await appFixture();a.click('app',{app:'photos'});
  const photos=Array.from(a.fixture.photos),days=photos.map(p=>p.daysAgo);
  assert.deepEqual(days,[...days].sort((x,y)=>x-y));assert.equal(new Set(days).size,5);assert.ok(days.every(n=>n>=1&&n<=7));
  const middle=photos[2].id;a.click('photo',{member:middle});
  a.input('photo-description','那天一起拍的 <3');a.click('photo-next');assert.equal(a.fixture.route.photo,photos[3].id);a.click('photo-prev');assert.equal(a.fixture.route.photo,middle);assert.match(a.root.innerHTML,/那天一起拍的 &lt;3/);
  a.click('photo',{member:photos[0].id});a.click('photo-prev');assert.equal(a.fixture.route.photo,photos[0].id);
  a.click('photo',{member:photos.at(-1).id});a.click('photo-next');assert.equal(a.fixture.route.photo,photos.at(-1).id);
  const restored=await appFixture({stored:a.fixture.state});restored.click('photo',{member:middle});assert.match(restored.root.innerHTML,/那天一起拍的 &lt;3/);assert.deepEqual(Array.from(restored.fixture.photos,p=>p.daysAgo),days);
  restored.click('photo-share',{member:middle});restored.click('photo-to-compose',{member:middle,type:'post'});assert.equal(restored.fixture.modal.caption,'那天一起拍的 <3');
});

test('home indicator returns from apps and settings can lock the screen',async()=>{
  const a=await appFixture();a.click('unlock');a.click('app',{app:'kakao'});a.elements.get('home-button').listeners.click();assert.equal(a.fixture.route.app,'home');
  a.click('app',{app:'settings'});assert.equal(a.fixture.modal.kind,'settings');a.click('lock-phone');assert.equal(a.fixture.route.app,'lock');
  a.elements.get('home-button').listeners.click();assert.equal(a.fixture.route.app,'home');
  assert.doesNotMatch(a.root.innerHTML,/small moments|和喜歡的人|點一下 App/);
  a.click('app',{app:'photos'});assert.doesNotMatch(a.root.innerHTML,/有些瞬間|和她們的日常/);
  a.click('photo',{member:'yeji'});assert.doesNotMatch(a.root.innerHTML,/每一張|插畫暫代|的一天/);
});
test('settings retains profile and restart without incoming editors or save transfer controls',async()=>{
  const a=await appFixture();a.click('settings');a.elements.get('player-name').value='서아';a.elements.get('player-username').value='seoa.diary';a.elements.get('player-bio').value='我的日常';a.submit('profile-form');assert.equal(a.fixture.state.profile.name,'서아');
  a.click('settings');assert.match(a.overlay.innerHTML,/重新開始/);assert.doesNotMatch(a.overlay.innerHTML,/編輯來訊|匯出|匯入|incoming-form/);
  a.click('chat-info',{member:'yeji'});assert.doesNotMatch(a.overlay.innerHTML,/編寫一則好友來訊|settings-incoming/);
});

test('browser storage restores progress and restart replaces it only after confirmation',async()=>{
  const a=await appFixture();a.click('open-chat',{channel:'kakao',member:'yeji'});a.input('chat-input','今天見');a.submit('chat-form');
  a.click('compose');a.click('select-photo',{member:'lia'});a.click('publish');
  await new Promise(resolve=>setImmediate(resolve));
  const persisted=JSON.parse(a.saved.get('itzy-phone-save-v1'));
  const restored=await appFixture({stored:persisted});assert.equal(restored.fixture.state.posts.length,1);assert.equal(restored.fixture.state.chats.kakao.yeji.at(-1).text,'今天見');
  restored.click('open-chat',{channel:'kakao',member:'yeji'});restored.input('chat-input','未送出的草稿');restored.click('settings');restored.click('reset');
  assert.doesNotMatch(restored.overlay.innerHTML,/匯出|匯入/);restored.click('close-modal');assert.equal(restored.fixture.state.posts.length,1);
  restored.click('settings');restored.click('reset');restored.click('confirm-reset');assert.equal(restored.fixture.route.app,'setup');assert.equal(restored.fixture.state.posts.length,0);assert.equal(restored.fixture.state.onboardingComplete,false);assert.ok(!restored.fixture.state.chats.kakao.yeji.some(m=>m.text==='今天見'));
  await new Promise(resolve=>setImmediate(resolve));
  const restarted=JSON.parse(restored.saved.get('itzy-phone-save-v1'));assert.equal(restarted.posts.length,0);assert.equal(restarted.onboardingComplete,false);
  restored.input('setup-username','rain.zip');restored.input('setup-nickname','小雨');restored.submit('setup-form');restored.click('open-chat',{channel:'kakao',member:'yeji'});assert.equal(restored.elements.get('chat-input').value,'');
});
