// 在最小 DOM 測試替身上驗證畫面狀態與事件接線；不取代真實瀏覽器視覺驗證。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&#39;',"'").replaceAll('&amp;','&');
async function appFixture() {
  const elements=new Map(),listeners={};
  let document;
  class Element {
    constructor(id='',owner=null){this.id=id;this.owner=owner;this._html='';this.value='';this.dataset={};this.style={};this.tagName='DIV';this.scrollTop=0;this.scrollHeight=500;this.classList={toggle:()=>{},add:()=>{},remove:()=>{}};this.listeners={};}
    set innerHTML(html){this._html=html;for(const [id,node] of elements)if(node.owner===this)elements.delete(id);for(const match of html.matchAll(/<(input|textarea|form|div|span|button|select)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Element(match[2],this);node.tagName=match[1].toUpperCase();const value=match[0].match(/\bvalue="([^"]*)"/);if(value)node.value=decode(value[1]);if(node.tagName==='TEXTAREA'){const content=html.slice(match.index+match[0].length).split('</textarea>')[0];node.value=decode(content);}elements.set(node.id,node);}}
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
  for(const id of ['app','overlay','screen','status-bar','status-time','seoul-clock','device-hint','toast','home-button','power-button','settings-button','help-button','image-upload','save-upload','signal','wifi'])elements.set(id,new Element(id));
  document={activeElement:null,querySelector:s=>elements.get(s.slice(1))||null,getElementById:id=>elements.get(id)||null,addEventListener:(type,handler)=>(listeners[type]??=[]).push(handler),createElement:()=>new Element()};
  const saved=new Map();const intervals=[];
  const context=vm.createContext({window:{},document,console,crypto:webcrypto,structuredClone,Date,Intl,Math,JSON,Map,Set,Blob,URL,HTMLImageElement:class{},setInterval:handler=>(intervals.push(handler),intervals.length),clearInterval(){},setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame:fn=>fn(),localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)}});
  let source=read('js/config.js')+'\n';
  for(const name of ['core','storage','icons','app'])source+=read(`js/${name}.js`).replace(/^import .+;\n/gm,'').replace(/^export /gm,'')+'\n';
  source+='globalThis.fixture={get state(){return state},get route(){return route},get modal(){return modal},runDueJobs,refresh,renderModal,createState,C};';
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  function click(action,data={}){const target={dataset:{action,...data},disabled:false,closest:selector=>selector==='[data-action]'?target:null};for(const handler of listeners.click||[])handler({target});}
  function submit(id){for(const handler of listeners.submit||[])handler({target:{id},preventDefault(){}});}
  return {context,elements,click,submit,fixture:context.fixture,root:elements.get('app'),overlay:elements.get('overlay')};
}

test('UI wiring unlocks, opens all apps, and supports independent KakaoTalk conversations',async()=>{
  const a=await appFixture();assert.match(a.root.innerHTML,/往上滑解鎖/);a.click('unlock');assert.equal(a.fixture.route.app,'home');assert.match(a.root.innerHTML,/首爾/);
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
  const a=await appFixture();a.click('photo',{member:'yuna'});assert.match(a.root.innerHTML,/和 Yuna 的一天/);a.click('photo-share',{member:'yuna'});a.click('photo-to-compose',{member:'yuna',type:'story'});assert.equal(a.fixture.modal.images[0].member,'yuna');a.click('publish');assert.equal(a.fixture.state.stories.at(-1).author,'me');assert.equal(a.fixture.state.events.yuna.phase,'queued');
  a.click('story',{member:'me'});assert.match(a.overlay.innerHTML,/story-viewer/);a.click('story-next');assert.equal(a.fixture.modal,null);
});
test('UI can edit profile and deliver an authored incoming message to the selected app',async()=>{
  const a=await appFixture();a.click('settings');a.elements.get('player-name').value='서아';a.elements.get('player-username').value='seoa.diary';a.elements.get('player-bio').value='我的日常';a.submit('profile-form');assert.equal(a.fixture.state.profile.name,'서아');
  a.click('settings-tab',{tab:'incoming'});a.elements.get('incoming-channel').value='instagram';a.elements.get('incoming-member').value='lia';a.elements.get('incoming-text').value='照片我看到了。';a.submit('incoming-form');assert.equal(a.fixture.state.chats.instagram.lia.at(-1).text,'照片我看到了。');assert.match(a.elements.get('toast').innerHTML,/照片我看到了/);
});
