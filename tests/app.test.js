// 在最小 DOM 測試替身上驗證畫面狀態與事件接線；不取代真實瀏覽器視覺驗證。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {splitChatText} from '../js/core.js';

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
  source+='globalThis.fixture={get state(){return state},get route(){return route},get modal(){return modal},get photos(){return photos},runDueJobs,processJobs,refresh,renderModal,createState,updatePostEngagement,shortTime,longDate,updateClock,C};';
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  function click(action,data={}){const target={dataset:{action,...data},disabled:false,closest:selector=>selector==='[data-action]'?target:null};return Promise.all((listeners.click||[]).map(handler=>handler({target})));}
  function submit(id){for(const handler of listeners.submit||[])handler({target:{id},preventDefault(){}});}
  function input(id,value){const target=elements.get(id);target.value=value;for(const handler of listeners.input||[])handler({target});}
  if(onboard&&!context.fixture.state.onboardingComplete){input('setup-username','seoyeon.zip');input('setup-nickname','서연');submit('setup-form');}
  return {context,elements,click,submit,input,saved,fixture:context.fixture,root:elements.get('app'),overlay:elements.get('overlay')};
}

test('UI wiring unlocks, opens all apps, and supports independent KakaoTalk conversations',async()=>{
  const a=await appFixture();assert.match(a.root.innerHTML,/鎖定畫面/);a.click('unlock');assert.equal(a.fixture.route.app,'home');assert.match(a.root.innerHTML,/首爾/);
  a.click('app',{app:'kakao'});assert.match(a.root.innerHTML,/Yeji/);a.click('open-chat',{channel:'kakao',member:'yeji'});a.elements.get('chat-input').value='今天一起吃飯？';a.submit('chat-form');assert.equal(a.fixture.state.chats.kakao.yeji.at(-1).text,'今天一起吃飯？');assert.equal(a.fixture.state.chats.kakao.yeji.at(-1).sender,'me');assert.equal(a.fixture.state.jobs.filter(j=>j.type==='incoming').length,0);
  a.click('open-chat',{channel:'kakao',member:'lia'});assert.doesNotMatch(a.root.innerHTML,/今天一起吃飯？/);
  for(const name of ['instagram','photos','phone','sms']){a.click('app',{app:name});assert.equal(a.fixture.route.app,name);assert.ok(a.root.innerHTML.length>100);}
});
test('lock notifications group unread messages by app and hide empty groups',async()=>{
  const a=await appFixture(),state=a.fixture.state;
  assert.match(a.root.innerHTML,/KakaoTalk 5 則通知/);
  assert.equal((a.root.innerHTML.match(/class="lock-notice"/g)||[]).length,1);
  assert.doesNotMatch(a.root.innerHTML,/Instagram|今天也要記得吃飯/);
  state.chats.instagram.yeji.push({id:'notice-1',sender:'yeji',text:'私訊內容',time:Date.now(),kind:'text',read:false});
  state.chats.instagram.lia.push({id:'notice-2',sender:'lia',text:'傳送貼文',time:Date.now(),kind:'post',postId:'post-1',read:false});
  state.chats.instagram.yuna.push({id:'notice-own',sender:'me',text:'我傳的訊息',time:Date.now(),kind:'text',read:false});
  a.fixture.refresh();
  assert.match(a.root.innerHTML,/Instagram 2 則通知/);
  assert.equal((a.root.innerHTML.match(/class="lock-notice"/g)||[]).length,2);
  a.click('ig-tab',{tab:'dm'});assert.equal(a.fixture.route.app,'instagram');assert.equal(a.fixture.route.page,'dm');
  a.click('open-chat',{channel:'instagram',member:'yeji'});a.click('lock-phone');
  assert.match(a.root.innerHTML,/Instagram 1 則通知/);
  a.click('open-chat',{channel:'instagram',member:'lia'});a.click('lock-phone');
  assert.doesNotMatch(a.root.innerHTML,/Instagram/);assert.match(a.root.innerHTML,/KakaoTalk 5 則通知/);
  a.click('kakao-tab',{tab:'chats'});assert.equal(a.fixture.route.app,'kakao');assert.equal(a.fixture.route.tab,'chats');
  for(const member of a.fixture.C.members)a.click('open-chat',{channel:'kakao',member:member.id});
  a.click('lock-phone');assert.doesNotMatch(a.root.innerHTML,/lock-notifications|lock-notice|則通知/);
  state.jobs.push({id:'notice-incoming',type:'incoming',channel:'instagram',member:'yuna',text:'新的訊息',dueAt:Date.now()});
  a.fixture.processJobs();assert.match(a.root.innerHTML,/Instagram 1 則通知/);
  assert.equal((a.root.innerHTML.match(/class="lock-notice"/g)||[]).length,1);
});
test('UI replaces the selected photo, publishes one image, comments, shares and shows own profile',async()=>{
  const a=await appFixture();a.click('unlock');a.click('compose');a.click('select-photo',{member:'yeji'});a.click('select-photo',{member:'lia'});a.elements.get('compose-caption').value='<script>alert(1)</script> 日常';a.click('publish');assert.equal(a.fixture.state.posts.length,1);const p=a.fixture.state.posts[0];assert.equal(p.images.length,1);assert.equal(p.images[0].member,'lia');assert.equal(a.fixture.state.events.yeji,undefined);assert.match(a.root.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(a.root.innerHTML,/<script>alert/);
  assert.doesNotMatch(a.root.innerHTML,/slide-arrow|slide-count|slide-dots/);a.click('like',{id:p.id});assert.equal(p.likes,1);a.click('bookmark',{id:p.id});assert.equal(a.fixture.state.bookmarked[0],p.id);
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
  a.input('setup-username','@rain.zip');a.submit('setup-form');assert.equal(a.fixture.state.onboardingComplete,true);assert.equal(a.fixture.state.profile.nickname,'小雨');assert.equal(a.fixture.state.profile.username,'rain.zip');assert.equal(a.fixture.route.app,'lock');assert.match(a.root.innerHTML,/KakaoTalk 5 則通知/);
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
  restored.click('settings');restored.click('reset');await restored.click('confirm-reset');assert.equal(restored.fixture.route.app,'setup');assert.equal(restored.fixture.state.posts.length,0);assert.equal(restored.fixture.state.onboardingComplete,false);assert.ok(!restored.fixture.state.chats.kakao.yeji.some(m=>m.text==='今天見'));
  await new Promise(resolve=>setImmediate(resolve));
  const restarted=JSON.parse(restored.saved.get('itzy-phone-save-v1'));assert.equal(restarted.posts.length,0);assert.equal(restarted.onboardingComplete,false);
  restored.input('setup-username','rain.zip');restored.input('setup-nickname','小雨');restored.submit('setup-form');restored.click('open-chat',{channel:'kakao',member:'yeji'});assert.equal(restored.elements.get('chat-input').value,'');
});

test('chat options send a selected reply, wait for the next node, and restore progress',async()=>{
  for(const channel of ['kakao']){
    const a=await appFixture();a.click('open-chat',{channel,member:'yeji'});
    assert.equal((a.root.innerHTML.match(/data-action="dialogue-choice"/g)||[]).length,1);
    a.click('dialogue-choice',{channel,member:'yeji',node:'welcome',choice:'reply'});
    assert.match(a.root.innerHTML,/正在輸入/);assert.doesNotMatch(a.root.innerHTML,/data-action="dialogue-choice"/);
    const welcomeReply=a.fixture.state.jobs.find(j=>j.type==='welcome-reply');a.fixture.processJobs(welcomeReply.dueAt);
    assert.doesNotMatch(a.root.innerHTML,/正在輸入|data-action="dialogue-choice"/);
    a.fixture.processJobs(a.fixture.state.randomDialogue.nextAt);
    assert.match(a.root.innerHTML,/一起去喝咖啡/);
    a.click('dialogue-choice',{channel,member:'yeji',node:'invite',choice:'coffee'});
    assert.equal(a.fixture.state.chats[channel].yeji.at(-1).text,'一起去喝咖啡？');assert.match(a.root.innerHTML,/正在輸入/);assert.doesNotMatch(a.root.innerHTML,/data-action="dialogue-choice"/);
    a.click('dialogue-choice',{channel,member:'yeji',node:'invite',choice:'coffee'});
    assert.equal(a.fixture.state.chats[channel].yeji.filter(m=>m.text==='一起去喝咖啡？').length,1);
    const restored=await appFixture({stored:a.fixture.state});restored.click('open-chat',{channel,member:'yeji'});
    const pending=restored.fixture.state.jobs.find(j=>j.type==='dialogue');restored.fixture.runDueJobs(restored.fixture.state,restored.fixture.C,pending.dueAt);restored.fixture.refresh();
    assert.match(restored.root.innerHTML,/下午吧，我想坐窗邊/);assert.doesNotMatch(restored.root.innerHTML,/改天好嗎/);
    restored.click('dialogue-choice',{channel,member:'yeji',node:'coffee',choice:'afternoon'});
    const last=restored.fixture.state.jobs.find(j=>j.type==='dialogue');restored.fixture.runDueJobs(restored.fixture.state,restored.fixture.C,last.dueAt);restored.fixture.refresh();
    assert.match(restored.root.innerHTML,/那就下午/);assert.doesNotMatch(restored.root.innerHTML,/data-action="dialogue-choice"/);
  }
});

test('all five KKT chats have a red heart beside send and keep separate drafts',async()=>{
  const a=await appFixture();
  for(const id of ['yeji','lia','ryujin','chaeryeong','yuna']){
    a.click('open-chat',{channel:'kakao',member:id});
    const markup=a.root.innerHTML;
    assert.ok(markup.indexOf('id="chat-input"')<markup.indexOf('data-action="chat-heart"'));
    assert.ok(markup.indexOf('data-action="chat-heart"')<markup.indexOf('class="send-button"'));
    assert.match(markup,/傳送紅色愛心/);assert.match(markup,/>❤️<\/button>/);assert.doesNotMatch(markup,/data-action="chat-emoji"/);
    a.input('chat-input',`還沒打完-${id}`);a.click('chat-heart');
    assert.equal(a.fixture.state.chats.kakao[id].at(-1).text,'❤️');assert.equal(a.elements.get('chat-input').value,`還沒打完-${id}`);
    const replies=a.fixture.state.jobs.filter(j=>j.type==='incoming'&&j.member===id);
    assert.ok(a.fixture.C.kakaoEmoji.replies[id].some(group=>group.length===replies.length&&group.every((text,i)=>text===replies[i].text)));
    if(replies.length){a.fixture.runDueJobs(a.fixture.state,a.fixture.C,Math.max(...replies.map(j=>j.dueAt)));a.fixture.refresh();assert.equal(a.fixture.state.chats.kakao[id].at(-1).sender,id);}
  }
  a.click('open-chat',{channel:'kakao',member:'yeji'});assert.equal(a.elements.get('chat-input').value,'還沒打完-yeji');
});

test('Instagram has no choice dialogue or heart shortcut and still delivers post-related messages',async()=>{
  const a=await appFixture();a.click('open-chat',{channel:'instagram',member:'yeji'});
  assert.doesNotMatch(a.root.innerHTML,/dialogue-choice|chat-heart|chat-emoji|正在輸入/);assert.equal(a.fixture.state.jobs.filter(j=>j.type==='dialogue').length,0);
  a.click('compose');a.click('select-photo',{member:'yeji'});a.click('publish');
  for(const type of ['photo-dm','photo-post','post-comment','photo-follow-up']){
    if(type==='photo-follow-up')for(const comment of a.fixture.state.jobs.filter(j=>j.type==='post-comment').sort((a,b)=>a.dueAt-b.dueAt))a.fixture.runDueJobs(a.fixture.state,a.fixture.C,comment.dueAt);
    const job=a.fixture.state.jobs.find(j=>j.type===type);assert.ok(job);a.fixture.runDueJobs(a.fixture.state,a.fixture.C,job.dueAt);
  }
  assert.equal(a.fixture.state.events.yeji.phase,'done');assert.equal(a.fixture.state.chats.instagram.yeji.at(-1).text,splitChatText(a.fixture.C.photoEvents.scripts.yeji.followUp).at(-1));assert.equal(a.fixture.state.chats.instagram.ryujin.length,0);
  a.click('open-chat',{channel:'instagram',member:'yeji'});assert.doesNotMatch(a.root.innerHTML,/data-action="dialogue-choice"/);
});

test('member comments appear live without losing the player comment draft',async()=>{
  const a=await appFixture();a.fixture.C.postComments.otherChance=0;
  a.click('compose');a.click('select-photo',{member:'yeji'});a.click('publish');
  const post=a.fixture.state.posts[0],job=a.fixture.state.jobs.find(j=>j.type==='post-comment');
  a.click('comments',{id:post.id});a.input('comment-input','還沒打完的留言');
  deliverPhotoPosts(a);a.fixture.processJobs(job.dueAt);
  assert.equal(post.comments[0].author,'yeji');assert.match(a.overlay.innerHTML,/yezyizhere/);assert.equal(a.elements.get('comment-input').value,'還沒打完的留言');
  assert.ok(a.overlay.innerHTML.includes(post.comments[0].text));
  a.submit('comment-form');assert.equal(post.comments.at(-1).author,'me');assert.equal(post.comments.at(-1).text,'還沒打完的留言');assert.equal(a.elements.get('comment-input').value,'');
  a.click('toast-open');assert.equal(a.fixture.modal.kind,'comments');assert.equal(a.fixture.modal.postId,post.id);
});

test('comments can be liked and replied to; likes show a count without a liker list',async()=>{
  const a=await appFixture();a.fixture.C.postComments.otherChance=0;a.click('compose');a.click('select-photo',{member:'yeji'});a.click('publish');
  const post=a.fixture.state.posts[0],job=a.fixture.state.jobs.find(j=>j.type==='post-comment');deliverPhotoPosts(a);a.fixture.processJobs(job.dueAt);const original=post.comments[0];
  a.click('comments',{id:post.id});a.click('like-comment',{id:post.id,comment:original.id});assert.deepEqual(Array.from(original.likedBy),['me']);assert.match(a.overlay.innerHTML,/aria-pressed="true"/);assert.match(a.overlay.innerHTML,/1 個讚/);
  a.click('like-comment',{id:post.id,comment:original.id});assert.equal(original.likedBy.length,0);
  a.click('reply-comment',{id:post.id,comment:original.id});assert.match(a.overlay.innerHTML,/正在回覆 @yezyizhere/);a.input('comment-input','這張我也好喜歡 ❤️');a.submit('comment-form');
  const reply=post.comments.at(-1);assert.equal(reply.parentId,original.id);assert.equal(reply.replyTo,original.id);assert.match(a.overlay.innerHTML,/class="comment-replies"/);assert.match(a.overlay.innerHTML,/class="comment-mention"/);assert.equal(a.elements.get('comment-input').value,'');
  a.input('comment-input','另一則還沒打完的留言');const like=a.fixture.state.jobs.find(j=>j.type==='comment-like');a.fixture.processJobs(like.dueAt);
  assert.deepEqual(Array.from(reply.likedBy),['yeji']);assert.match(a.overlay.innerHTML,/1 個讚/);assert.equal(a.elements.get('comment-input').value,'另一則還沒打完的留言');
  assert.doesNotMatch(a.overlay.innerHTML,/data-action="comment-likes"|like-person/);assert.equal(a.elements.get('comment-input').value,'另一則還沒打完的留言');
  a.click('toggle-replies',{comment:original.id});assert.ok(!a.overlay.innerHTML.includes(`data-comment-id="${reply.id}"`));a.click('toggle-replies',{comment:original.id});assert.ok(a.overlay.innerHTML.includes(`data-comment-id="${reply.id}"`));
  a.click('toast-open');assert.equal(a.fixture.modal.kind,'comments');assert.ok(a.fixture.modal.expandedThreads.includes(original.id));assert.match(a.overlay.innerHTML,/1 個讚/);
});

test('reply threads and member likes remain visible after restoring browser progress',async()=>{
  const a=await appFixture();a.fixture.C.postComments.otherChance=0;a.click('compose');a.click('select-photo',{member:'lia'});a.click('publish');
  const post=a.fixture.state.posts[0],job=a.fixture.state.jobs.find(j=>j.type==='post-comment');deliverPhotoPosts(a);a.fixture.processJobs(job.dueAt);const root=post.comments[0];
  a.click('comments',{id:post.id});a.click('reply-comment',{id:post.id,comment:root.id});a.input('comment-input','謝謝你，Lia');a.submit('comment-form');const pending=a.fixture.state.jobs.find(j=>j.type==='comment-like');
  const b=await appFixture({stored:a.fixture.state});b.click('comments',{id:post.id});b.fixture.processJobs(pending.dueAt);b.click('toggle-replies',{comment:root.id});
  assert.match(b.overlay.innerHTML,/謝謝你，Lia/);assert.match(b.overlay.innerHTML,/1 個讚/);assert.ok(b.fixture.state.posts.find(p=>p.id===post.id).comments.at(-1).likedBy.includes('lia'));
});

test('member post fans render local avatars, support replies and keep drafts during like updates',async()=>{
  const a=await appFixture();a.click('compose');a.click('select-photo',{member:'yeji'});a.click('publish');
  for(const type of ['photo-dm','photo-post']){const job=a.fixture.state.jobs.find(j=>j.type===type);a.fixture.processJobs(job.dueAt);}
  const post=a.fixture.state.posts.find(p=>p.author==='yeji'),root=post.comments[0],fan=a.fixture.state.fans[root.author];
  a.click('comments',{id:post.id});assert.match(a.overlay.innerHTML,/fan-avatar/);assert.ok(a.overlay.innerHTML.includes(fan.username));assert.doesNotMatch(a.overlay.innerHTML,/profile\/fan-/);
  a.click('reply-comment',{id:post.id,comment:root.id});a.input('comment-input','謝謝你喜歡');a.submit('comment-form');
  const reply=post.comments.at(-1),job=a.fixture.state.jobs.find(j=>j.type==='comment-like');
  a.input('comment-input','未完成的留言');const old=post.likes;a.fixture.updatePostEngagement(post.time+60000);
  assert.ok(post.likes>old);assert.equal(a.elements.get('comment-input').value,'未完成的留言');
  a.fixture.processJobs(job.dueAt);assert.ok(reply.likedBy.includes(root.author));assert.equal(a.elements.get('comment-input').value,'未完成的留言');
  assert.match(a.overlay.innerHTML,/1 個讚/);assert.doesNotMatch(a.overlay.innerHTML,/data-action="comment-likes"/);
  const b=await appFixture({stored:a.fixture.state});b.click('comments',{id:post.id});assert.ok(b.overlay.innerHTML.includes(fan.username));assert.equal(b.fixture.state.posts.find(p=>p.id===post.id).comments.length,post.comments.length);
});

test('clock and calendar follow browser local time including date boundaries',async()=>{
  const a=await appFixture(),previous=process.env.TZ,now=Date.parse('2026-01-02T23:45:00Z');
  try{
    process.env.TZ='Pacific/Honolulu';assert.equal(a.fixture.shortTime(now),'13:45');assert.match(a.fixture.longDate(now),/1月2日/);
    process.env.TZ='Asia/Tokyo';assert.equal(a.fixture.shortTime(now),'08:45');assert.match(a.fixture.longDate(now),/1月3日/);
    a.fixture.updateClock();assert.equal(a.elements.get('status-time').textContent,a.fixture.shortTime(Date.now()));
    assert.equal(a.elements.get('lock-time').textContent,a.elements.get('status-time').textContent);
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

function deliverPhotoPosts(a) {
  for(const type of ['photo-dm','photo-post']){const job=a.fixture.state.jobs.find(j=>j.type===type);if(job)a.fixture.processJobs(job.dueAt);}
}

test('restart clears all Instagram content, drafts and delayed reactions across reload',async()=>{
  const a=await appFixture();a.fixture.C.postComments.otherChance=1;
  a.click('compose');a.click('select-photo',{member:'yeji'});a.click('publish');const own=a.fixture.state.posts[0];
  deliverPhotoPosts(a);const comments=a.fixture.state.jobs.filter(j=>j.type==='post-comment').sort((x,y)=>x.dueAt-y.dueAt);
  for(const job of comments)a.fixture.processJobs(job.dueAt);
  a.click('like',{id:own.id});a.click('bookmark',{id:own.id});a.click('comments',{id:own.id});a.click('reply-comment',{id:own.id,comment:own.comments[0].id});a.input('comment-input','重置前的回覆');a.submit('comment-form');
  a.click('close-modal');a.click('compose-story');a.click('select-photo',{member:'lia'});a.click('publish');
  a.click('share-post',{id:own.id});a.click('send-post',{id:own.id,member:'yuna'});a.input('chat-input','重置前未送出的私訊');
  const oldDue=Math.max(...a.fixture.state.jobs.map(j=>j.dueAt));
  assert.ok(a.fixture.state.posts.length>=2);assert.ok(a.fixture.state.stories.length);assert.ok(Object.keys(a.fixture.state.fans).length);assert.ok(a.fixture.state.jobs.some(j=>j.type==='comment-like'));
  a.click('settings');a.click('reset');await a.click('confirm-reset');
  assert.equal(a.fixture.route.app,'setup');assert.equal(a.overlay.innerHTML,'');assert.equal(a.elements.get('toast').innerHTML,'');
  const empty=s=>{assert.equal(s.posts.length,0);assert.equal(s.stories.length,0);assert.equal(s.jobs.length,0);assert.equal(s.bookmarked.length,0);assert.equal(Object.keys(s.events).length,0);assert.equal(Object.keys(s.fans).length,0);for(const list of Object.values(s.chats.instagram))assert.equal(list.length,0);};
  empty(a.fixture.state);
  a.input('setup-username','new.midzy');a.input('setup-nickname','小新');a.submit('setup-form');a.fixture.processJobs(oldDue+100000);empty(a.fixture.state);
  a.click('app',{app:'instagram'});assert.match(a.root.innerHTML,/尚無貼文/);a.click('open-chat',{channel:'instagram',member:'yuna'});assert.equal(a.elements.get('chat-input').value,'');
  await new Promise(resolve=>setImmediate(resolve));
  const b=await appFixture({stored:JSON.parse(a.saved.get('itzy-phone-save-v1'))});empty(b.fixture.state);b.click('app',{app:'instagram'});assert.match(b.root.innerHTML,/尚無貼文/);
  b.click('compose');b.click('select-photo',{member:'yeji'});b.click('publish');assert.equal(b.fixture.state.events.yeji.phase,'queued');assert.ok(b.fixture.state.jobs.some(j=>j.type==='photo-dm'));
});

test('Instagram chats sort newest first for incoming and outgoing messages and retain order on reload',async()=>{
  const a=await appFixture(),members=Array.from(a.fixture.C.members,m=>m.id);
  const order=app=>Array.from(app.root.innerHTML.matchAll(/data-action="open-chat" data-channel="instagram" data-member="([^"]+)"/g),m=>m[1]);
  a.click('ig-tab',{tab:'dm'});assert.deepEqual(order(a),members);
  const now=Date.now();
  for(const [i,id] of ['yuna','yeji','ryujin'].entries())a.fixture.state.jobs.push({id:`sort-${id}`,type:'incoming',channel:'instagram',member:id,text:`${id} 的新訊息`,dueAt:now-1000+i*100});
  for(const job of [...a.fixture.state.jobs].sort((x,y)=>x.dueAt-y.dueAt))a.fixture.processJobs(job.dueAt);
  assert.deepEqual(order(a),['ryujin','yeji','yuna','lia','chaeryeong']);
  a.click('open-chat',{channel:'instagram',member:'lia'});a.input('chat-input','換我傳訊息');a.submit('chat-form');a.click('dm-back');
  assert.deepEqual(order(a),['lia','ryujin','yeji','yuna','chaeryeong']);
  const b=await appFixture({stored:a.fixture.state});b.click('ig-tab',{tab:'dm'});assert.deepEqual(order(b),order(a));
  b.click('search',{channel:'instagram'});const searchOrder=Array.from(b.overlay.innerHTML.matchAll(/data-action="open-chat" data-channel="instagram" data-member="([^"]+)"/g),m=>m[1]);assert.deepEqual(searchOrder,order(b));
});

test('welcome chats show the greeting, wait for the choice, then deliver a single final response',async()=>{
  const a=await appFixture();
  for(const member of a.fixture.C.members){
    const messages=a.fixture.state.chats.kakao[member.id],count=messages.length;
    a.click('open-chat',{channel:'kakao',member:member.id});
    assert.equal(messages.length,count);assert.equal((a.root.innerHTML.match(/data-action="dialogue-choice"/g)||[]).length,1);
    assert.doesNotMatch(a.root.innerHTML,/正在輸入/);
    const node=a.fixture.C.dialogues[member.id].nodes.welcome,choiceCount=splitChatText(node.choices[0].text).length,responseCount=splitChatText(node.response).length;assert.ok(!a.root.innerHTML.includes(node.response));
    a.click('dialogue-choice',{channel:'kakao',member:member.id,node:'welcome',choice:'reply'});
    assert.equal(messages.at(-1).text,splitChatText(node.choices[0].text).at(-1));assert.equal(messages.length,count+choiceCount);
    assert.match(a.root.innerHTML,/正在輸入/);assert.doesNotMatch(a.root.innerHTML,/data-action="dialogue-choice"/);
    a.click('dialogue-choice',{channel:'kakao',member:member.id,node:'welcome',choice:'reply'});assert.equal(messages.length,count+choiceCount);
    const pending=a.fixture.state.jobs.find(j=>j.type==='welcome-reply'&&j.member===member.id);a.fixture.processJobs(pending.dueAt);
    assert.equal(messages.at(-1).text,splitChatText(node.response).at(-1));assert.equal(messages.length,count+choiceCount+responseCount);assert.doesNotMatch(a.root.innerHTML,/正在輸入|data-action="dialogue-choice"/);
    a.click('kakao-back');a.click('open-chat',{channel:'kakao',member:member.id});assert.equal(messages.length,count+choiceCount+responseCount);
  }
});

test('Instagram comments use IDs and show like counts without a list',async()=>{
  const a=await appFixture();a.click('compose');a.click('select-photo',{member:'yeji'});a.click('publish');deliverPhotoPosts(a);
  const post=a.fixture.state.posts.find(p=>p.author==='yeji'),root=post.comments[0],fan=a.fixture.state.fans[root.author];
  fan.name='不應顯示的用戶名字';
  a.click('comments',{id:post.id});assert.ok(a.overlay.innerHTML.includes(fan.username));assert.doesNotMatch(a.overlay.innerHTML,/不應顯示的用戶名字/);
  a.click('reply-comment',{id:post.id,comment:root.id});assert.ok(a.overlay.innerHTML.includes(`@${fan.username}`));
  a.input('comment-input','謝謝你喜歡');a.submit('comment-form');const reply=post.comments.at(-1),job=a.fixture.state.jobs.find(j=>j.type==='comment-like');a.fixture.processJobs(job.dueAt);
  assert.doesNotMatch(a.elements.get('toast').innerHTML,/不應顯示的用戶名字/);
  assert.match(a.overlay.innerHTML,/1 個讚/);assert.doesNotMatch(a.overlay.innerHTML,/data-action="comment-likes"|like-person|不應顯示的用戶名字/);

});

test('A can start without other welcomes; finishing B welcome cannot interrupt A',async()=>{
  const a=await appFixture();a.click('open-chat',{channel:'kakao',member:'yeji'});a.click('dialogue-choice',{channel:'kakao',member:'yeji',node:'welcome',choice:'reply'});
  assert.equal(a.fixture.state.randomDialogue.nextAt,null);
  a.fixture.processJobs(a.fixture.state.jobs.find(j=>j.type==='welcome-reply').dueAt);
  const due=a.fixture.state.randomDialogue.nextAt;assert.ok(due);assert.equal(a.fixture.state.welcomeDone.lia,undefined);
  a.fixture.processJobs(due);assert.equal(a.fixture.state.randomDialogue.activeMember,'yeji');assert.match(a.root.innerHTML,/data-node="invite"/);
  a.click('open-chat',{channel:'kakao',member:'lia'});a.click('dialogue-choice',{channel:'kakao',member:'lia',node:'welcome',choice:'reply'});
  a.fixture.processJobs(a.fixture.state.jobs.find(j=>j.type==='welcome-reply').dueAt);
  assert.equal(a.fixture.state.welcomeDone.lia,true);assert.equal(a.fixture.state.randomDialogue.activeMember,'yeji');assert.doesNotMatch(a.root.innerHTML,/data-node="invite"/);
  const restored=await appFixture({stored:a.fixture.state});restored.fixture.processJobs(due+1000000);assert.equal(restored.fixture.state.randomDialogue.activeMember,'yeji');assert.equal(restored.fixture.state.chats.kakao.lia.length,3);
});

test('setup screen includes the photo and AI statements and the default avatar reads MIDZY',async()=>{
  const a=await appFixture({onboard:false});assert.match(a.root.innerHTML,/照片素材皆來自 ITZY 官方和成員帳號/);assert.match(a.root.innerHTML,/部分對話與互動使用 AI 生成/);
  assert.ok(a.root.innerHTML.indexOf('開始</button>')<a.root.innerHTML.indexOf('setup-disclaimer'));
  assert.match(read('assets/avatar-me.svg'),/>MIDZY<\/text>/);assert.equal(a.fixture.state.profile.avatar,'assets/avatar-me.svg');
});

test('post likes show member IDs while fans remain a numeric count across reload',async()=>{
  const a=await appFixture();a.fixture.C.postComments.otherChance=0;
  a.click('compose');a.click('select-photo',{member:'yeji'});a.click('publish');const post=a.fixture.state.posts[0];
  deliverPhotoPosts(a);const comment=a.fixture.state.jobs.find(j=>j.type==='post-comment');a.fixture.processJobs(comment.dueAt);
  const ownMarkup=a.root.innerHTML.split(`data-post="${post.id}"`)[1].split('</article>')[0];
  assert.match(ownMarkup,/class="post-member-likes">yezyizhere 說讚/);assert.match(ownMarkup,/1 個讚/);
  assert.doesNotMatch(ownMarkup,/data-action="[^"]*likes"/);
  a.fixture.updatePostEngagement(post.time+60000);const total=post.likes;
  a.click('like',{id:post.id});assert.equal(post.likes,total+1);a.click('like',{id:post.id});assert.equal(post.likes,total);
  const b=await appFixture({stored:a.fixture.state});b.click('ig-tab',{tab:'profile'});b.click('view-post',{id:post.id});
  assert.match(b.root.innerHTML,/post-member-likes">yezyizhere 說讚/);assert.match(b.root.innerHTML,new RegExp(`${total} 個讚`));
});

test('multi-sentence choices and replies render separate bubbles while welcome and random locks stay intact',async()=>{
  const a=await appFixture(),script=a.fixture.C.dialogues.yeji;
  script.nodes.welcome.choices[0].text='我也想你了。週末見！';script.nodes.welcome.response='好呀。那就週末見！';
  script.nodes.invite.message='我想你了。什麼時候一起出去玩？';
  a.click('open-chat',{channel:'kakao',member:'yeji'});
  assert.match(a.root.innerHTML,/>我也想你了 週末見！<\/button>/);assert.equal((a.root.innerHTML.match(/data-action="dialogue-choice"/g)||[]).length,1);
  a.click('dialogue-choice',{channel:'kakao',member:'yeji',node:'welcome',choice:'reply'});
  assert.match(a.root.innerHTML,/<div class="bubble\s*">我也想你了<\/div>/);assert.match(a.root.innerHTML,/<div class="bubble\s*">週末見！<\/div>/);
  assert.equal(a.fixture.state.welcomeDone.yeji,undefined);assert.equal(a.fixture.state.randomDialogue.nextAt,null);
  const pending=a.fixture.state.jobs.find(j=>j.type==='welcome-reply');a.fixture.processJobs(pending.dueAt);
  assert.equal(a.fixture.state.welcomeDone.yeji,true);assert.match(a.root.innerHTML,/<div class="bubble\s*">好呀<\/div>/);
  a.fixture.processJobs(a.fixture.state.randomDialogue.nextAt);assert.equal(a.fixture.state.randomDialogue.activeMember,'yeji');
  assert.match(a.root.innerHTML,/<div class="bubble\s*">我想你了<\/div>/);assert.match(a.root.innerHTML,/<div class="bubble\s*">什麼時候一起出去玩？<\/div>/);
  a.input('chat-input','我也想你了。今天有空嗎？');a.submit('chat-form');
  assert.deepEqual(Array.from(a.fixture.state.chats.kakao.yeji.slice(-2),m=>m.text),['我也想你了','今天有空嗎？']);
  const bubbles=[...a.root.innerHTML.matchAll(/class="bubble[^\"]*">([^<]*)<\/div>/g)].map(m=>m[1]);assert.ok(bubbles.every(text=>!text.includes('。')));
  a.click('sms-thread',{id:'delivery'});const sms=[...a.root.innerHTML.matchAll(/class="bubble\s*">([^<]*)<\/div>/g)].map(m=>m[1]);
  assert.ok(sms.length>2);assert.ok(sms.every(text=>!text.includes('。')));
});

test('KakaoTalk starts in age order and new incoming or outgoing messages reorder chats and search',async()=>{
  const a=await appFixture(),members=Array.from(a.fixture.C.members,m=>m.id);
  const order=(markup,channel)=>Array.from(markup.matchAll(new RegExp(`data-action="open-chat" data-channel="${channel}" data-member="([^"]+)"`,'g')),m=>m[1]);
  a.click('kakao-tab',{tab:'chats'});assert.deepEqual(order(a.root.innerHTML,'kakao'),members);
  const now=Date.now();
  for(const [i,id] of ['yuna','lia','chaeryeong'].entries()){
    a.fixture.state.jobs.push({id:`kakao-sort-${id}`,type:'incoming',channel:'kakao',member:id,text:`${id} 的新訊息`,dueAt:now-3000+i*1000});
    a.fixture.processJobs(now-3000+i*1000);
  }
  assert.deepEqual(order(a.root.innerHTML,'kakao'),['chaeryeong','lia','yuna','yeji','ryujin']);
  a.click('open-chat',{channel:'kakao',member:'yeji'});a.click('kakao-back');
  assert.deepEqual(order(a.root.innerHTML,'kakao'),['chaeryeong','lia','yuna','yeji','ryujin']);
  a.click('open-chat',{channel:'kakao',member:'ryujin'});a.input('chat-input','換我傳訊息。週末一起出去玩？');a.submit('chat-form');a.click('kakao-back');
  const expected=['ryujin','chaeryeong','lia','yuna','yeji'];assert.deepEqual(order(a.root.innerHTML,'kakao'),expected);
  a.click('search',{channel:'kakao'});assert.deepEqual(order(a.overlay.innerHTML,'kakao'),expected);a.click('close-modal');
  a.click('kakao-tab',{tab:'friends'});assert.deepEqual(order(a.root.innerHTML,'kakao'),members);
  const restored=await appFixture({stored:a.fixture.state});restored.click('kakao-tab',{tab:'chats'});assert.deepEqual(order(restored.root.innerHTML,'kakao'),expected);
  restored.click('ig-tab',{tab:'dm'});assert.deepEqual(order(restored.root.innerHTML,'instagram'),members);
});

test('photo DM parts arrive 1.5 seconds apart without losing drafts and posts show no address',async()=>{
  const a=await appFixture();a.click('compose');a.click('select-photo',{member:'ryujin'});a.click('publish');
  assert.doesNotMatch(a.root.innerHTML,/서울, 대한민국/);
  const first=a.fixture.state.jobs.find(j=>j.type==='photo-dm');a.fixture.processJobs(first.dueAt);
  a.click('open-chat',{channel:'instagram',member:'ryujin'});assert.equal(a.fixture.state.chats.instagram.ryujin.length,1);
  a.input('chat-input','還沒打完的回覆');const next=a.fixture.state.jobs.find(j=>j.photoReply==='question');
  a.fixture.processJobs(next.dueAt-1);assert.equal(a.fixture.state.chats.instagram.ryujin.length,1);
  a.fixture.processJobs(next.dueAt);assert.equal(a.fixture.state.chats.instagram.ryujin.length,2);
  assert.equal(a.elements.get('chat-input').value,'還沒打完的回覆');assert.match(a.root.innerHTML,/怎麼突然發了？/);
  const post=a.fixture.state.jobs.find(j=>j.type==='photo-post');a.fixture.processJobs(post.dueAt);a.click('ig-tab',{tab:'feed'});
  assert.equal((a.root.innerHTML.match(/class="post-header"/g)||[]).length,2);assert.doesNotMatch(a.root.innerHTML,/서울, 대한민국/);
});
