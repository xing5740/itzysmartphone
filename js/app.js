import {uid,createState,addMessage,queueKeywordReplies,publish,runDueJobs,unreadCount,validateSave} from './core.js';
import {openStorage,saveState} from './storage.js';
import {icon} from './icons.js';

const C=window.PHONE_CONFIG;
const $=selector=>document.querySelector(selector);
const root=$('#app'), overlay=$('#overlay'), screen=$('#screen');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const member=id=>C.members.find(m=>m.id===id);
const personName=id=>id==='me'?state.profile.name:member(id)?.name||id;
const username=id=>id==='me'?state.profile.username:member(id)?.username||id;
const shortTime=time=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(time);
const longDate=time=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(time);
const age=time=>{const mins=Math.max(0,Math.floor((Date.now()-time)/60000));return mins<1?'剛剛':mins<60?`${mins} 分鐘前`:mins<1440?`${Math.floor(mins/60)} 小時前`:`${Math.floor(mins/1440)} 天前`;};
const safeSrc=src=>typeof src==='string' && (/^(assets|photo|ins)\/[a-zA-Z0-9_/.\-]+$/.test(src)&&!src.includes('..') || /^data:image\/(jpeg|png|webp|gif);base64,/.test(src))?src:'assets/moment-yeji.svg';
function image(src,fallback,alt,classes='',alternates=[]) {return `<img src="${esc(safeSrc(src))}" alt="${esc(alt)}" class="${classes}" data-fallback="${esc(fallback)}" data-alternates="${esc(JSON.stringify(alternates))}" draggable="false">`;}
function avatar(id,classes='',phone=false) {
  const src=id==='me'?state.profile.avatar:(phone?C.assets.phoneAvatar(id):C.assets.instagramAvatar(id));
  const alternatives=phone?[`${src}.jpeg`,`${src}.jpg`,`${src}.png`]:[];
  return image(src||'photo/ins/profile/me.jpeg',`assets/avatar-${id==='me'?'me':id}.svg`,personName(id),`avatar ${classes}`,alternatives);
}
function photoImage(photo,classes='') {return image(photo.src,`assets/moment-${photo.member||'yeji'}.svg`,photo.member?`與 ${personName(photo.member)} 的${photo.side==='her'?'對應':'回憶'}照片`:'選擇的照片',classes);}
const photos=C.members.map(m=>({id:m.id,member:m.id,side:'me',src:C.assets.pairedPhoto(m.id,'me')}));
let state;
let route={app:'lock'};
let modal=null, storyTimer, toastTimer, clockTimer, pointerStart=null;
let toastAction=null, previousRoute={app:'home'};
const drafts={};
let storageWarningShown=false, saveBroken=false, originalBrokenSave=null, inFlightUpload=false;

document.addEventListener('error',event=>{
  const img=event.target;
  if (!(img instanceof HTMLImageElement)) return;
  let candidates=[];try{candidates=JSON.parse(img.dataset.alternates||'[]');}catch{}
  const next=candidates.shift();
  if (next) {img.dataset.alternates=JSON.stringify(candidates);img.src=next;return;}
  if (img.dataset.fallback) {const fallback=img.dataset.fallback;delete img.dataset.fallback;img.src=fallback;img.dataset.placeholder='true';}
},true);

function snapshotFocus(container) {
  const active=document.activeElement;
  return active && container.contains(active) && active.id ? {id:active.id,start:active.selectionStart,end:active.selectionEnd} : null;
}
function restoreFocus(focus) {
  if (!focus) return;
  const el=document.getElementById(focus.id);if (!el)return;
  el.focus({preventScroll:true});try{el.setSelectionRange(focus.start,focus.end);}catch{}
}
function captureDraft() {
  const input=$('#chat-input');if(input && route.member)drafts[`${route.app}:${route.member}`]=input.value;
  const caption=$('#compose-caption');if(caption && modal?.kind==='compose')modal.caption=caption.value;
}
async function persist() {
  if(saveBroken)return;
  try {await saveState(state);}
  catch {if(!storageWarningShown){storageWarningShown=true;toast('儲存空間不足或瀏覽器不允許儲存。請先匯出存檔。');}}
}
function commit(render=true) {persist();if(render)refresh();}
function go(next) {
  captureDraft();
  if (modal) closeModal(false);
  route={...next};
  if(route.page==='chat') markRead(route.app==='kakao'?'kakao':'instagram',route.member);
  refresh(true);
}
function markRead(channel,id){if(!state.chats[channel]?.[id])return;state.chats[channel][id].forEach(x=>x.read=true);persist();}
function unlock(){go({app:'home'});}
function refresh(navigating=false) {
  captureDraft();
  const focus=snapshotFocus(root), oldScroll=root.querySelector('.scroll'), scrollTop=oldScroll?.scrollTop||0;
  screen.className=`screen app-${route.app}${route.page==='chat'?' is-chat':''}`;
  $('#status-bar').classList.toggle('wallpaper-status',['lock','home'].includes(route.app));
  $('#device-hint').textContent=route.app==='lock'?'往上滑，開啟你的日常':route.app==='home'?'點一下 App，看看她們的日常':'按下 Home，回到主畫面';
  root.className=`app-root ${route.app==='kakao'&&route.page==='chat'?'chat-bg':''} ${route.app==='instagram'&&route.page==='chat'?'ig-chat':''} ${route.app==='sms'&&route.page==='chat'?'sms-chat':''}`;
  if(route.app==='lock')root.innerHTML=renderLock();
  else if(route.app==='home')root.innerHTML=renderHome();
  else if(route.app==='kakao')root.innerHTML=renderKakao();
  else if(route.app==='instagram')root.innerHTML=renderInstagram();
  else if(route.app==='photos')root.innerHTML=renderPhotos();
  else if(route.app==='phone')root.innerHTML=renderPhone();
  else if(route.app==='sms')root.innerHTML=renderSMS();
  const scroll=root.querySelector('.scroll');
  if(scroll) {
    if(route.page==='chat')scroll.scrollTop=scroll.scrollHeight;
    else if(!navigating)scroll.scrollTop=scrollTop;
  }
  restoreFocus(focus);
  updateClock();
}
function wallpaper(kind) {return `<div class="wallpaper" style="background-image:url('${esc(C.wallpapers[kind])}'),url('assets/${kind}screen.svg')"></div>`;}
function renderLock() {
  const total=unreadCount(state,'kakao')+unreadCount(state,'instagram');
  const latest=[];
  for (const channel of ['kakao','instagram'])for(const m of C.members){const list=state.chats[channel][m.id].filter(x=>!x.read&&x.sender!=='me');if(list.length)latest.push({channel,member:m.id,message:list.at(-1),count:list.length});}
  latest.sort((a,b)=>b.message.time-a.message.time);
  return `<section class="lock-screen" id="lock-swipe" aria-label="鎖定畫面，往上滑或按 Enter 解鎖">${wallpaper('lock')}<button class="lock-open" data-action="unlock" aria-label="點一下解鎖"></button><div class="lock-icon">${icon('unlock')}</div><div class="lock-date" id="lock-date">${longDate(Date.now())}</div><div class="lock-time" id="lock-time">${shortTime(Date.now())}</div><div class="lock-subtitle">${icon('cloud')} 首爾 · ${C.weather.temperature}° · ${C.weather.condition}</div><div class="lock-notifications">${latest.slice(0,2).map(x=>`<button class="lock-notice" data-action="open-chat" data-channel="${x.channel}" data-member="${x.member}"><span class="notice-app ${x.channel}">${icon(x.channel==='kakao'?'chat':'instagram', '',x.channel==='kakao')}</span><div><strong>${personName(x.member)} <span style="font-weight:400;color:#91968a;font-size:9px">· ${x.channel==='kakao'?'KakaoTalk':'Instagram'}</span></strong><p>${esc(x.message.text||'傳送了一則貼文')}</p></div></button>`).join('')}</div><button class="lock-bottom" data-action="unlock">${icon('arrowUp')}往上滑解鎖<span>${total?`${total} 則未讀訊息`:'今天，也和喜歡的人靠近一點。'}</span></button><button class="lock-settings" data-action="settings" aria-label="遊戲設定">設定</button></section>`;
}
function appIcon(name) {
  if(name==='kakao')return '<span class="app-icon icon-kakao"><span class="kakao-mark">TALK</span></span>';
  if(name==='instagram')return `<span class="app-icon icon-instagram">${icon('instagram')}</span>`;
  if(name==='photos')return `<span class="app-icon icon-photos"><span class="petals">${['#ef4f5c','#f99845','#f7d84d','#9cc45f','#4dc5b3','#4eafdf','#7779c2','#ce75b4'].map((c,i)=>`<i style="background:${c};transform:rotate(${i*45}deg)"></i>`).join('')}</span></span>`;
  if(name==='safari')return '<span class="app-icon icon-safari"><span class="safari-compass"></span></span>';
  return `<span class="app-icon icon-${name}">${icon(name==='sms'?'chat':name)}</span>`;
}
function tile(app,label,disabled=false) {
  const unread=['kakao','instagram'].includes(app)?unreadCount(state,app):0;
  return `<button class="app-tile" data-action="${disabled?'unavailable':'app'}" data-app="${app}" ${disabled?'disabled aria-disabled="true" title="暫未開放"':''} aria-label="${label}${disabled?'，暫未開放':''}"><span style="position:relative">${appIcon(app)}${unread?`<span class="app-badge">${unread>99?'99+':unread}</span>`:''}</span><span>${label}</span></button>`;
}
function renderHome() {
  const w=C.weather;
  return `<section class="home-screen">${wallpaper('home')}<button class="mobile-settings" data-action="settings" aria-label="遊戲設定">設定</button><div class="weather-widget" role="button" tabindex="0" data-action="weather" aria-label="首爾天氣，查看預報來源"><div class="weather-top"><span class="weather-city">首爾 <span style="font-size:10px;opacity:.7">서울</span></span><span class="weather-date">${w.date.replaceAll('-','.')}</span></div><div class="weather-summary"><span class="weather-temp">${w.temperature}°</span><div class="weather-condition">${icon('cloud')}${w.condition} · 最高 ${w.high}° 最低 ${w.low}°</div></div><div class="weather-hours">${w.hours.map(h=>`<div class="weather-hour"><span>${h.time}</span>${icon('cloud')}<span>${h.temp}°</span></div>`).join('')}</div><p class="weather-note">${w.note}</p></div><div class="app-grid">${tile('kakao','KakaoTalk')}${tile('instagram','Instagram')}${tile('photos','照片')}</div><div class="home-midnote">small moments, with you ♡</div><div class="home-dock">${tile('phone','電話')}${tile('sms','訊息')}${tile('safari','Safari',true)}${tile('camera','相機',true)}</div></section>`;
}
function topbar(title,buttons='',backAction='home') {
  return `<header class="app-topbar"><button class="top-button header-back" data-action="${backAction}" aria-label="返回">${icon('back')}</button><h2 class="app-title" style="font-size:16px;text-align:center">${esc(title)}</h2>${buttons||'<span style="width:24px"></span>'}</header>`;
}
function kakaoNav(){return `<nav class="bottom-nav" aria-label="KakaoTalk 導覽"><button data-action="kakao-tab" data-tab="friends" class="${route.tab==='friends'?'active':''}">${icon('user', '',route.tab==='friends')}<span>好友</span></button><button data-action="kakao-tab" data-tab="chats" class="${route.tab!=='friends'?'active':''}"><span class="nav-icon-wrap">${icon('chat','',route.tab!=='friends')}${unreadCount(state,'kakao')?`<span class="app-badge">${unreadCount(state,'kakao')}</span>`:''}</span><span>聊天</span></button></nav>`;}
function renderKakao() {
  if(route.page==='chat')return renderChat('kakao',route.member);
  const friends=route.tab==='friends';
  return `<header class="app-topbar"><h2 class="app-title">${friends?'好友':'聊天'}</h2><button class="top-button" data-action="search" data-channel="kakao" aria-label="搜尋好友">${icon('search')}</button><button class="top-button" data-action="settings" aria-label="編輯遊戲訊息">${icon('more')}</button></header><div class="scroll">${friends?`<button class="list-row self-row" data-action="settings">${avatar('me','kakao-avatar')}<div class="list-row-copy"><strong>${esc(state.profile.name)}</strong><p>今天也想和你們一起。</p></div></button><div class="section-label"><span>好友 ${C.members.length}</span><span>⌃</span></div>`:''}${C.members.map(m=>renderChatRow('kakao',m,friends)).join('')}</div>${kakaoNav()}`;
}
function renderChatRow(channel,m,friends=false) {
  const messages=state.chats[channel][m.id],latest=messages.at(-1),unread=unreadCount(state,channel,m.id);
  return `<button class="list-row" data-action="open-chat" data-channel="${channel}" data-member="${m.id}">${avatar(m.id,channel==='kakao'?'kakao-avatar':'')}<div class="list-row-copy"><strong>${channel==='instagram'?esc(m.username):m.name}</strong><p>${friends?m.korean:esc(latest?(latest.kind==='post'?'傳送了一則貼文':latest.text):(channel==='instagram'?`${m.displayName} · 傳送訊息`:'來說點什麼吧'))}</p></div>${!friends?`<div class="list-row-meta"><span>${latest?shortTime(latest.time):''}</span>${unread?`<span class="unread-pill">${unread}</span>`:''}</div>`:'<span class="friend-status">♡</span>'}</button>`;
}
function renderChat(channel,id) {
  const m=member(id),messages=state.chats[channel][id];
  const inputValue=drafts[`${channel==='kakao'?'kakao':'instagram'}:${id}`]||'';
  return `<header class="app-topbar"><button class="top-button header-back" data-action="${channel==='kakao'?'kakao-back':'dm-back'}" aria-label="返回聊天室列表">${icon('back')}</button>${channel==='instagram'?avatar(id,'small'):''}<div class="header-name"><strong>${channel==='kakao'?m.name:esc(m.username)}</strong>${channel==='instagram'?`<small>${esc(m.displayName)}</small>`:''}</div><button class="top-button" data-action="chat-info" data-member="${id}" aria-label="聊天資訊">${icon('info')}</button></header><div class="scroll chat-log"><div class="chat-date">${longDate(messages[0]?.time||Date.now())}</div>${messages.length?messages.map(message=>renderMessage(message,channel,id)).join(''):`<div class="no-messages">${icon('chat')}<br>你和 ${m.name} 的聊天室<br>傳一則訊息，開始你們的日常。</div>`}</div><form class="chat-compose" id="chat-form"><button type="button" data-action="${channel==='instagram'?'chat-share':'chat-emoji'}" aria-label="${channel==='instagram'?'分享貼文':'加入表情符號'}">${icon(channel==='instagram'?'image':'smile')}</button><label class="sr-only" for="chat-input">傳送訊息</label><input id="chat-input" placeholder="${channel==='kakao'?'輸入訊息':'傳送訊息…'}" autocomplete="off" maxlength="2000" value="${esc(inputValue)}"><button class="send-button" aria-label="傳送">${channel==='kakao'?icon('arrowUp'):'傳送'}</button></form>`;
}
function renderMessage(message,channel,id) {
  const mine=message.sender==='me';
  let body=esc(message.text);
  if(message.kind==='post') {
    const post=state.posts.find(p=>p.id===message.postId);
    body=post?`<button class="dm-shared-post" data-action="view-post" data-id="${post.id}">${photoImage(post.images[0])}<strong>${esc(username(post.author))}</strong><p>${esc(post.caption).slice(0,90)}</p></button>`:'這則貼文已不存在。';
  }
  return `<div class="message-row ${mine?'mine':''}">${!mine?avatar(id,`small ${channel==='kakao'?'kakao-avatar':''}`):''}<div class="message-content">${!mine&&channel==='kakao'?`<div class="message-author">${personName(id)}</div>`:''}<div class="bubble-with-time"><div class="bubble ${message.kind==='post'?'dm-shared-post':''}">${body}</div><span class="message-time">${mine&&channel==='kakao'?'<span class="read">1</span>':''}${shortTime(message.time)}</span></div></div></div>`;
}
function instagramNav() {return `<nav class="bottom-nav" aria-label="Instagram 導覽"><button data-action="ig-tab" data-tab="feed" class="${!route.page||route.page==='feed'?'active':''}" aria-label="Instagram 首頁">${icon('home','',!route.page||route.page==='feed')}</button><button data-action="compose" aria-label="建立貼文">${icon('plus')}</button><button data-action="ig-tab" data-tab="profile" class="${route.page==='profile'?'active':''}" aria-label="我的個人檔案">${avatar('me','tiny')}</button></nav>`;}
function renderInstagram() {
  if(route.page==='chat')return renderChat('instagram',route.member);
  if(route.page==='dm')return `<header class="app-topbar"><button class="top-button header-back" data-action="ig-tab" data-tab="feed" aria-label="返回 Instagram 首頁">${icon('back')}</button><h2 class="app-title" style="font-size:17px">${esc(state.profile.username)}</h2><button class="top-button" data-action="search" data-channel="instagram" aria-label="搜尋訊息">${icon('search')}</button></header><div class="section-label"><span style="color:#222;font-weight:600">訊息</span><span>好友 ${C.members.length}</span></div><div class="scroll">${C.members.map(m=>renderChatRow('instagram',m)).join('')}</div>`;
  if(route.page==='profile')return renderProfile();
  if(route.page==='post') {
    const post=state.posts.find(p=>p.id===route.postId);
    return `${topbar('貼文','','post-back')}<div class="scroll">${post?renderPost(post):'<p class="list-empty">找不到貼文</p>'}</div>${instagramNav()}`;
  }
  return `<header class="app-topbar ig-topbar"><h2 class="ig-logo">Instagram</h2><button class="top-button" data-action="ig-saved" aria-label="珍藏貼文">${icon('bookmark')}</button><button class="top-button" style="position:relative" data-action="ig-tab" data-tab="dm" aria-label="私訊">${icon('send')}${unreadCount(state,'instagram')?'<span class="notification-dot"></span>':''}</button></header><div class="scroll"><div class="story-tray">${renderStoryTray()}</div>${route.saved?`<div class="section-label"><span>珍藏貼文</span><button data-action="ig-tab" data-tab="feed">顯示全部</button></div>`:''}${(route.saved?state.posts.filter(p=>state.bookmarked.includes(p.id)):state.posts).map(renderPost).join('')||`<div class="feed-empty"><div class="empty-decoration">${icon('camera')}</div><h3>${route.saved?'把喜歡的日常留起來':'日常，等你先分享。'}</h3><p>${route.saved?'點貼文下方的書籤，就能在這裡找到。':'去相簿選張照片吧。<br>也許，她也記得那一天。'}</p><button class="text-action" data-action="${route.saved?'ig-tab':'compose'}" data-tab="feed">${route.saved?'回到首頁':'分享第一張照片 →'}</button></div>`}</div>${instagramNav()}`;
}
function activeStories(id){return state.stories.filter(s=>s.author===id&&(Date.now()-s.createdAt<86400000));}
function renderStoryTray() {
  const own=activeStories('me');
  return `<div class="story-avatar"><button data-action="${own.length?'story':'compose-story'}" data-member="me" style="padding:0" aria-label="${own.length?'觀看你的限時動態':'發佈限時動態'}"><span class="story-ring ${!own.length?'empty':own.every(s=>s.seen)?'seen':''}">${avatar('me')}</span></button><button class="story-add" data-action="compose-story" aria-label="新增限時動態">${icon('plus')}</button><span>你的限時動態</span></div>${C.members.map(m=>{const stories=activeStories(m.id);return `<button class="story-avatar" data-action="story" data-member="${m.id}" aria-label="觀看 ${m.name} 的限時動態"><span class="story-ring ${!stories.length?'empty':stories.every(s=>s.seen)?'seen':''}">${avatar(m.id)}</span><span>${m.name}</span></button>`;}).join('')}`;
}
function renderPost(post) {
  const count=post.images.length,slide=Math.max(0,Math.min(post.slide||0,count-1));
  return `<article class="post" data-post="${post.id}"><header class="post-header">${avatar(post.author)}<div class="post-username">${esc(username(post.author))}<small>서울, 대한민국</small></div><button class="top-button" data-action="post-options" data-id="${post.id}" aria-label="貼文選項">${icon('more')}</button></header><div class="post-image-wrap" data-swipe-post="${post.id}">${photoImage(post.images[slide],'post-image')}${count>1?`<span class="slide-count">${slide+1}/${count}</span>${slide>0?`<button class="slide-arrow prev" data-action="slide" data-id="${post.id}" data-dir="-1" aria-label="上一張">${icon('back')}</button>`:''}${slide<count-1?`<button class="slide-arrow next" data-action="slide" data-id="${post.id}" data-dir="1" aria-label="下一張">${icon('chevron')}</button>`:''}`:''}</div><div class="post-actions"><button data-action="like" data-id="${post.id}" class="${post.liked?'liked':''}" aria-label="${post.liked?'取消按讚':'按讚'}">${icon('heart','',post.liked)}</button><button data-action="comments" data-id="${post.id}" aria-label="留言">${icon('chat')}</button><button data-action="share-post" data-id="${post.id}" aria-label="傳送貼文到聊天室">${icon('send')}</button>${count>1?`<span class="slide-dots">${post.images.map((_,i)=>`<i class="${i===slide?'active':''}"></i>`).join('')}</span>`:''}<button data-action="bookmark" data-id="${post.id}" aria-label="${state.bookmarked.includes(post.id)?'取消珍藏':'珍藏貼文'}">${icon('bookmark','',state.bookmarked.includes(post.id))}</button></div><div class="post-details">${post.likes?`<div class="post-likes">${post.likes.toLocaleString()} 個讚</div>`:''}<div class="post-caption"><strong>${esc(username(post.author))}</strong>${esc(post.caption).replaceAll('\n','<br>')}</div><button class="comment-preview" data-action="comments" data-id="${post.id}">${post.comments.length?`查看全部 ${post.comments.length} 則留言`:'新增留言…'}</button><div class="post-date">${age(post.time)}</div></div></article>`;
}
function renderProfile() {
  const posts=state.posts.filter(p=>p.author==='me');
  return `<header class="app-topbar"><h2 class="app-title" style="font-size:18px">${esc(state.profile.username)}</h2><button class="top-button" data-action="compose" aria-label="新增貼文">${icon('plus')}</button><button class="top-button" data-action="settings" aria-label="個人設定">${icon('more')}</button></header><div class="scroll"><div class="profile-info"><div class="profile-stats">${avatar('me','large')}<div class="profile-numbers"><div><strong>${posts.length}</strong>貼文</div><div><strong>5</strong>粉絲</div><div><strong>5</strong>追蹤中</div></div></div><div class="profile-bio"><strong>${esc(state.profile.name)}</strong>${esc(state.profile.bio)}</div><button class="profile-edit" data-action="settings">編輯個人檔案</button></div><div class="profile-tabs"><span class="active">${icon('grid')}</span><span style="color:#ccc">${icon('user')}</span></div>${posts.length?`<div class="profile-grid">${posts.map(p=>`<button data-action="view-post" data-id="${p.id}" data-from="profile" aria-label="查看我的貼文">${photoImage(p.images[0])}${p.images.length>1?icon('layers'):''}</button>`).join('')}</div>`:`<div class="feed-empty"><div class="empty-decoration">${icon('camera')}</div><h3>收集你的每個日常。</h3><p>你發佈的照片，都會留在這裡。</p><button class="text-action" data-action="compose">分享第一則貼文</button></div>`}</div>${instagramNav()}`;
}
function renderPhotos() {
  if(route.page==='detail') {
    const photo=photos.find(p=>p.id===route.photo);
    return `<div class="photo-full">${topbar('回憶','','photos-back')}<div class="photo-full-image">${photoImage(photo)}</div><div class="photo-full-info"><strong>和 ${personName(photo.member)} 的一天</strong><br>每一張，都有想留下來的理由。<span class="asset-hint">尚未提供的照片會以插畫暫代。</span></div><div class="photo-toolbar"><button data-action="photo-share" data-member="${photo.member}">${icon('share')}分享</button><span style="font-size:10px;color:#aaa">${photos.indexOf(photo)+1} / 5</span><button data-action="photo-next" aria-label="下一張照片">${icon('chevron')}</button></div></div>`;
  }
  return `<div class="photos-title"><small>和她們的日常</small><h2>照片</h2><small>回憶 · ${photos.length} 張照片</small></div><div class="scroll"><div class="photos-grid">${photos.map(p=>`<button class="photo-tile" data-action="photo" data-member="${p.member}" aria-label="查看與 ${personName(p.member)} 的照片">${photoImage(p)}<span class="photo-tile-label">${personName(p.member)}</span></button>`).join('')}</div><div class="feed-empty" style="min-height:150px"><p>有些瞬間，想讓她也看見。<br>點開照片，就能分享到 Instagram。</p></div></div><nav class="bottom-nav"><button class="active" aria-current="page">${icon('image')}圖庫</button></nav>`;
}
function renderPhone() {
  if(route.page==='contact') {
    const m=member(route.member);
    return `${topbar('聯絡人','','phone-back')}<div class="scroll contact-detail">${avatar(m.id,'',true)}<h2>${m.name}</h2><p>${m.korean}</p><div class="contact-buttons"><button data-action="open-chat" data-channel="kakao" data-member="${m.id}">${icon('chat')}訊息</button><button disabled title="暫未開放撥號">${icon('phone')}通話</button><button data-action="open-chat" data-channel="instagram" data-member="${m.id}">${icon('instagram')}Instagram</button></div><div class="contact-field">聯絡方式<span>KakaoTalk · ${m.name}</span></div><div class="contact-field">備註<span style="color:#555">我的好朋友 ${m.emoji}</span></div><p>目前尚未開放撥打電話。</p></div>`;
  }
  const tab=route.tab||'recent';
  const content=tab==='contacts'?`<h2 class="phone-title">聯絡人</h2><div class="search-box">${icon('search')}<input id="contact-search" placeholder="搜尋聯絡人" aria-label="搜尋聯絡人"></div><div class="scroll" id="contact-list">${C.members.map(m=>`<button class="list-row" data-action="contact" data-member="${m.id}" data-search-name="${m.name.toLowerCase()} ${m.korean}">${avatar(m.id,'small',true)}<div class="list-row-copy"><strong>${m.name}</strong></div>${icon('chevron')}</button>`).join('')}</div>`:tab==='keypad'?`<h2 class="phone-title">撥號鍵盤</h2><div class="scroll"><div class="keypad">${['1','2','3','4','5','6','7','8','9','*','0','#'].map((x,i)=>`<button disabled>${x}<small>${['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ','','+',''][i]}</small></button>`).join('')}<span></span><button class="call-key" disabled aria-label="撥號暫未開放">${icon('phone')}</button></div><p class="keypad-note">今天，先用訊息聊天吧。<br>撥打電話功能暫未開放。</p></div>`:`<h2 class="phone-title">通話記錄</h2><div class="ios-tabs"><button class="active" aria-current="true">全部</button><button data-action="missed-calls">未接來電</button></div><div class="scroll">${C.members.map((m,i)=>`<div class="call-row"><span class="call-direction">${icon('phone')}</span>${avatar(m.id,'small',true)}<div class="call-row-copy"><strong>${m.name}</strong><small>${i%2?'撥出':'來電'} · ${['12 分 08 秒','5 分 32 秒','28 分 14 秒','8 分 46 秒','17 分 02 秒'][i]}</small></div><time>${['今天','昨天','星期四','星期三','星期二'][i]}</time><button class="info-button" data-action="call-info" data-member="${m.id}" aria-label="${m.name} 的通話資訊">${icon('info')}</button></div>`).join('')}<p class="pending-label">之前和她們的通話，都記得。</p></div>`;
  return `${content}<nav class="bottom-nav phone-bottom">${[['recent','clock','通話記錄'],['contacts','user','聯絡人'],['keypad','grid','鍵盤']].map(([id,ic,label])=>`<button class="${tab===id?'active':''}" data-action="phone-tab" data-tab="${id}">${icon(ic)}${label}</button>`).join('')}</nav>`;
}
function renderSMS() {
  if(route.page==='chat'){
    const thread=C.sms.find(x=>x.id===route.thread);
    return `${topbar(thread.name,'','sms-back')}<div class="scroll chat-log"><div class="chat-date">${thread.time}</div>${thread.messages.map(text=>`<div class="message-row"><div class="message-content"><div class="bubble">${esc(text)}</div></div></div>`).join('')}</div><div class="sms-readonly">系統通知簡訊 · 無法回覆</div>`;
  }
  return `<h2 class="sms-title">訊息</h2><div class="scroll">${C.sms.map(t=>`<button class="list-row sms-row" data-action="sms-thread" data-id="${t.id}"><div class="sms-icon">${icon('user')}</div><div class="list-row-copy"><strong>${esc(t.name)}</strong><p>${esc(t.messages[0])}</p></div><div class="list-row-meta"><span>${t.time}</span>${icon('chevron')}</div></button>`).join('')}</div>`;
}

function sheet(title,body,footer='',className='') {return `<section class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><span class="sheet-handle"></span><header class="sheet-header"><button data-action="close-modal" aria-label="關閉">${icon('close')}</button><h2>${esc(title)}</h2><span style="width:20px"></span></header><div class="sheet-scroll">${body}</div>${footer}</section>`;}
function openModal(value) {
  captureDraft();clearTimeout(storyTimer);
  modal=value;renderModal();
  requestAnimationFrame(()=>{const target=overlay.querySelector('input:not([type=file]),textarea,button');target?.focus({preventScroll:true});});
}
function closeModal(render=true) {captureDraft();clearTimeout(storyTimer);modal=null;overlay.innerHTML='';if(render)refresh();}
function renderModal() {
  if (!modal){overlay.innerHTML='';return;}
  const focus=snapshotFocus(overlay),scrollTop=overlay.querySelector('.sheet-scroll')?.scrollTop||0;
  const type=modal.kind;
  if(type==='compose') {
    const isStory=modal.type==='story',selected=modal.images;
    overlay.innerHTML=sheet(isStory?'新增限時動態':'新增貼文',`<p class="sheet-description">${isStory?'選一張照片，讓她們看看你的此刻。':'選擇回憶照片，或從裝置上傳。可選擇最多 10 張。'}</p><span class="sheet-section-label">你的回憶相簿</span><div class="sheet-photo-grid">${photos.map(p=>{const index=selected.findIndex(x=>x.id===p.id);return `<button class="sheet-photo-choice ${index>=0?'selected':''}" data-action="select-photo" data-member="${p.member}" aria-label="${index>=0?'取消選擇':'選擇'} ${personName(p.member)} 的照片">${photoImage(p)}<span class="selection-number">${index>=0?index+1:''}</span></button>`;}).join('')}</div><button class="upload-button" data-action="upload-images" ${inFlightUpload?'disabled':''}>${icon('plus')}${inFlightUpload?'正在處理照片…':'從裝置選擇照片'}</button>${selected.length?`<div class="compose-preview">${selected.map((p,i)=>`<button data-action="remove-photo" data-index="${i}" aria-label="移除第 ${i+1} 張照片">${photoImage(p)}<span class="remove-image">×</span></button>`).join('')}</div>`:''}<p class="compose-count">已選 ${selected.length} / ${isStory?1:10} 張${isStory?' · 顯示 24 小時':''}</p>${!isStory?`<label class="field-label" for="compose-caption">寫下這一刻</label><textarea class="text-field" id="compose-caption" rows="3" maxlength="2200" placeholder="今天想說些什麼…">${esc(modal.caption||'')}</textarea>`:''}<button class="primary-button" data-action="publish" ${!selected.length||inFlightUpload?'disabled':''}>${icon(isStory?'plus':'share')} ${isStory?'分享到限時動態':'分享貼文'}</button>`);
  } else if(type==='photo-share'){
    overlay.innerHTML=sheet('分享照片',`<div style="width:64px;height:64px;margin:0 auto 15px">${photoImage(photos.find(p=>p.member===modal.member),'post-image')}</div>${[['post','Instagram 貼文','分享一張照片，留在你的個人檔案。'],['story','限時動態','和她們分享此刻，顯示 24 小時。']].map(([type,title,note])=>`<button class="share-choice" data-action="photo-to-compose" data-type="${type}" data-member="${modal.member}">${icon(type==='post'?'instagram':'plus')}<div><strong>${title}</strong><small>${note}</small></div>${icon('chevron')}</button>`).join('')}`);
  } else if(type==='comments') {
    const post=state.posts.find(p=>p.id===modal.postId);
    overlay.innerHTML=sheet('留言',`<div class="comment-row">${avatar(post.author,'small')}<div class="comment-content"><strong>${esc(username(post.author))}</strong>${esc(post.caption)}<small>${age(post.time)}</small></div></div><div style="height:1px;background:#eee;margin:5px 0 18px"></div>${post.comments.map(c=>`<div class="comment-row">${avatar(c.author,'small')}<div class="comment-content"><strong>${esc(username(c.author))}</strong>${esc(c.text)}<small>${age(c.time)}</small></div></div>`).join('')||'<p class="comments-empty">還沒有留言，來說點什麼吧。</p>'}`,`<form class="chat-compose" id="comment-form">${avatar('me','tiny')}<input id="comment-input" placeholder="新增留言…" maxlength="1000" autocomplete="off" aria-label="留言內容"><button style="color:#6f89b2;font-size:11px">發佈</button></form>`,'comments-sheet');
  } else if(type==='share-post') {
    const post=state.posts.find(p=>p.id===modal.postId);
    overlay.innerHTML=sheet('傳送貼文',`<p class="sheet-description">傳給好友，聊聊這張照片。</p>${C.members.map(m=>`<button class="share-recipient" data-action="send-post" data-member="${m.id}" data-id="${post.id}">${avatar(m.id)}<div><strong>${m.name}</strong><small>${esc(m.username)}</small></div><span class="share-send">傳送</span></button>`).join('')}`);
  } else if(type==='story') renderStoryModal();
  else if(type==='settings')renderSettings();
  else if(type==='help')overlay.innerHTML=sheet('這支手機怎麼玩？',`<ol class="help-list"><li><strong>滑開日常</strong><br>鎖定畫面向上滑、點一下畫面，或按 Enter 即可解鎖。下方圓形 Home 鍵回到桌面；手機右側按鈕可鎖定。</li><li><strong>去和她們聊天</strong><br>KakaoTalk 與 Instagram 私訊都有五位好友。你可以自由傳訊；自動回覆關鍵字預留給你設定。</li><li><strong>分享一張回憶</strong><br>打開「照片」，選一張分享到 Instagram。她會先私訊你，再分享另一個視角的照片，接著另一位好友就會發現。</li><li><strong>讓故事自己長大</strong><br>可以發單張、多圖、限動、留言，或把貼文傳給好友。頭貼與照片還沒放入時會顯示替代插畫。</li><li><strong>存下你們的日常</strong><br>進度只儲存在目前瀏覽器。「遊戲設定」可改名字、模擬好友來訊、匯出與匯入存檔。</li></ol><p class="settings-note">本作為非官方同人模擬，所有訊息與貼文皆屬虛構，不會連接真實 Instagram 或 KakaoTalk。</p>`);
  else if(type==='weather') {
    const w=C.weather;
    overlay.innerHTML=sheet('首爾天氣',`<div class="weather-detail"><h3>首爾 서울</h3>${icon('cloud')}<div class="weather-temp">${w.temperature}°</div><p>${w.condition} · 最高 ${w.high}° 最低 ${w.low}°<br>${w.note}</p></div><p class="settings-note">固定天氣快照：${w.checkedAt}<br>此為製作當天保存的預報，不會自動更新。</p><a class="link-source" href="${esc(w.source)}" target="_blank" rel="noreferrer">查看天氣資料來源 ↗</a>`);
  } else if(type==='search') {
    overlay.innerHTML=sheet(modal.channel==='kakao'?'搜尋好友':'搜尋訊息',`<div class="search-box" style="margin:0 0 8px">${icon('search')}<input id="chat-search" placeholder="輸入好友名稱或帳號" aria-label="搜尋好友"></div><div id="chat-search-results">${C.members.map(m=>`<div data-search-name="${esc(`${m.name} ${m.username} ${m.korean}`.toLowerCase())}">${renderChatRow(modal.channel,m)}</div>`).join('')}</div>`);
  } else if(type==='chat-info') {
    const m=member(modal.member);
    overlay.innerHTML=sheet('聊天資訊',`<div style="text-align:center">${avatar(m.id,'large')}<h3 style="font-size:15px">${m.name} · ${m.korean}</h3><p style="font-size:11px;color:#999">@${esc(m.username)}</p></div><p class="sheet-description">你們是共同好友。這個聊天室由你編寫故事，沒有設定關鍵字時，對方不會自動回覆。</p><button class="primary-button" data-action="settings-incoming">編寫一則好友來訊</button>`);
  } else if(type==='call-info'){
    const i=C.members.findIndex(m=>m.id===modal.member),m=member(modal.member);
    overlay.innerHTML=sheet('通話詳細資訊',`<div class="contact-detail" style="padding:12px">${avatar(m.id,'large',true)}<h2>${m.name}</h2><div class="contact-field">${['今天','昨天','星期四','星期三','星期二'][i]}<span>${i%2?'撥出電話':'來電'} · ${['12 分 08 秒','5 分 32 秒','28 分 14 秒','8 分 46 秒','17 分 02 秒'][i]}</span></div><button class="secondary-button" data-action="contact" data-member="${m.id}">查看聯絡人</button></div>`);
  } else if(type==='notice')overlay.innerHTML=sheet(modal.title,`<p class="sheet-description">${esc(modal.text)}</p><button class="primary-button" data-action="close-modal">知道了</button>`);
  else if(type==='reset')overlay.innerHTML=sheet('重新開始？',`<p class="sheet-description">將清除這個瀏覽器的聊天、貼文、限動與照片事件進度，並套用目前的初始劇本。建議先匯出存檔。</p><button class="secondary-button" data-action="export-save">先匯出存檔</button><button class="primary-button danger" data-action="confirm-reset">清除進度，重新開始</button>`);
  else if(type==='post-options')overlay.innerHTML=sheet('貼文選項',`<button class="share-choice" data-action="share-post" data-id="${modal.postId}">${icon('send')}<strong>傳送到聊天室</strong></button><p class="settings-note">此模擬版本保留貼文，讓照片事件與聊天室分享維持完整。</p>`);
  else if(type==='pick-post')overlay.innerHTML=sheet('選擇要分享的貼文',`${state.posts.map(p=>`<button class="share-choice" data-action="send-post" data-id="${p.id}" data-member="${route.member}"><span style="width:47px;height:47px">${photoImage(p.images[0],'post-image')}</span><div><strong>${esc(username(p.author))}</strong><small>${esc(p.caption).slice(0,50)||'照片貼文'}</small></div>${icon('send')}</button>`).join('')||'<p class="sheet-description">目前沒有貼文，先發佈一張照片吧。</p>'}`);
  if(type!=='story'){const scroll=overlay.querySelector('.sheet-scroll');if(scroll)scroll.scrollTop=scrollTop;restoreFocus(focus);}
}
function renderSettings() {
  const tab=modal.tab||'profile';
  let content;
  if(tab==='profile')content=`<form id="profile-form"><p class="sheet-description">你是住在韓國、和五位成員都熟識的女生。名字和帳號可以自由修改。</p><label class="field-label" for="player-name">名字</label><input class="text-field" id="player-name" value="${esc(state.profile.name)}" maxlength="40" required><label class="field-label" for="player-username">Instagram 帳號</label><input class="text-field" id="player-username" value="${esc(state.profile.username)}" maxlength="30" pattern="[A-Za-z0-9_.]+" title="請使用英文字母、數字、底線或句點" required><label class="field-label" for="player-bio">個人簡介</label><textarea class="text-field" id="player-bio" rows="3" maxlength="150">${esc(state.profile.bio)}</textarea><button type="button" class="secondary-button" data-action="upload-avatar">更換我的頭貼</button><button class="primary-button">儲存個人檔案</button></form>`;
  else if(tab==='incoming')content=`<form id="incoming-form"><p class="sheet-description">替好友寫一則訊息，傳進你的手機。正式劇本、定時來訊和關鍵字回覆可在 js/config.js 編輯。</p><div class="form-row"><label><span class="field-label">App</span><select class="text-field" id="incoming-channel"><option value="kakao" ${modal.channel!=='instagram'?'selected':''}>KakaoTalk</option><option value="instagram" ${modal.channel==='instagram'?'selected':''}>Instagram</option></select></label><label><span class="field-label">傳訊者</span><select class="text-field" id="incoming-member">${C.members.map(m=>`<option value="${m.id}" ${m.id===modal.member?'selected':''}>${m.name}</option>`).join('')}</select></label></div><label class="field-label" for="incoming-text">她想說的話</label><textarea id="incoming-text" class="text-field" rows="5" maxlength="2000" placeholder="在這裡編輯訊息內容…" required></textarea><button class="primary-button">傳送到我的手機</button></form>`;
  else content=`<section class="settings-section"><h3>把日常帶走</h3><p>進度會自動儲存在目前的瀏覽器，包含你上傳的照片。換裝置或清除瀏覽器資料前，先匯出存檔。</p><button class="secondary-button" data-action="export-save">${icon('download')} 匯出存檔</button><button class="secondary-button" data-action="import-save">匯入存檔</button></section><section class="settings-section"><h3>照片劇情進度</h3><p>${C.members.map(m=>`${m.name} → ${personName(m.observer)}：${({queued:'已分享，等待私訊',asked:'已收到私訊',posted:'她也分享了',done:'已被好友發現'})[state.events[m.id]?.phase]||'尚未觸發'}`).join('<br>')}</p></section><button class="secondary-button" data-action="reset" style="color:#b16c74">重新開始遊戲</button><p class="settings-note">所有內容皆為非官方同人虛構。<br>這支手機不會對真實帳號發文或傳送訊息。</p>`;
  overlay.innerHTML=`<section class="sheet" role="dialog" aria-modal="true" aria-label="遊戲設定"><span class="sheet-handle"></span><header class="sheet-header"><button data-action="close-modal" aria-label="關閉">${icon('close')}</button><h2>遊戲設定</h2><span style="width:20px"></span></header><nav class="settings-tabs">${[['profile','我的身分'],['incoming','編輯來訊'],['save','遊戲存檔']].map(([id,label])=>`<button class="${tab===id?'active':''}" data-action="settings-tab" data-tab="${id}">${label}</button>`).join('')}</nav><div class="sheet-scroll">${saveBroken?'<p class="error-note">原存檔無法讀取，目前使用暫時進度。原資料尚未被覆蓋，請先匯出或備份。</p>':''}${content}</div></section>`;
  const av=overlay.querySelector('.avatar');if(av)av.style.margin='auto';
}
function renderStoryModal() {
  let stories=activeStories(modal.member);
  if(!stories.length){closeModal(false);toast('目前沒有可觀看的限時動態');return;}
  modal.index=Math.max(0,Math.min(modal.index||0,stories.length-1));
  const s=stories[modal.index];s.seen=true;persist();
  overlay.innerHTML=`<section class="story-viewer" role="dialog" aria-modal="true" aria-label="${personName(s.author)} 的限時動態"><div class="story-bars">${stories.map((_,i)=>`<span class="${i<modal.index?'done':i===modal.index?'current':''}"><i></i></span>`).join('')}</div><header class="story-heading">${avatar(s.author,'small')}<div><strong>${esc(username(s.author))}</strong><small>${age(s.createdAt)}</small></div><button data-action="story-pause" aria-label="暫停限時動態">Ⅱ</button><button data-action="close-modal" aria-label="關閉限時動態">${icon('close')}</button></header><div class="story-picture">${image(s.src,`assets/moment-${s.author==='me'?'yeji':s.author}.svg`,'限時動態照片')}<div class="story-tap"><button data-action="story-prev" aria-label="上一則限時動態"></button><button data-action="story-next" aria-label="下一則限時動態"></button></div>${s.demo?'<span class="story-demo-tag">示範限動 · 可在劇本設定關閉</span>':''}</div><footer class="story-footer"><span>${s.author==='me'?'你的限時動態 · 24 小時後消失':''}</span>${s.author!=='me'?`<button data-action="story-reply" data-member="${s.author}">傳送訊息 ${icon('send')}</button>`:'<button data-action="compose-story">再分享一刻 ＋</button>'}</footer></section>`;
  clearTimeout(storyTimer);storyTimer=setTimeout(nextStory,6000);
}
function nextStory(){if(modal?.kind!=='story')return;const stories=activeStories(modal.member);if(modal.index+1<stories.length){modal.index++;renderStoryModal();}else closeModal();}
function toast(text,notice=null) {
  clearTimeout(toastTimer);toastAction=notice;
  $('#toast').innerHTML=notice?`<button class="toast" data-action="toast-open">${avatar(notice.member,'small')}<div><strong>${personName(notice.member)} · ${notice.postId?'Instagram':notice.channel==='kakao'?'KakaoTalk':'Instagram'}</strong><p>${esc(text)}</p></div></button>`:`<div class="toast toast-simple">${esc(text)}</div>`;
  toastTimer=setTimeout(()=>{$('#toast').innerHTML='';toastAction=null;},notice?5200:3000);
}
function showCompose(type='post',selected=[]) {openModal({kind:'compose',type,images:selected.map(p=>({...p})),caption:''});}
function slidePost(id,dir){const p=state.posts.find(p=>p.id===id);if(!p)return;p.slide=Math.max(0,Math.min((p.slide||0)+dir,p.images.length-1));commit();}
function sendSharedPost(id,recipient) {
  const post=state.posts.find(p=>p.id===id);if(!post)return;
  addMessage(state,'instagram',recipient,'傳送了一則貼文','me',Date.now(),{kind:'post',postId:id});
  commit(false);go({app:'instagram',page:'chat',member:recipient});toast(`已將貼文傳送給 ${personName(recipient)}`);
}
function updateClock(){const now=Date.now();$('#status-time').textContent=shortTime(now);$('#seoul-clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);const time=$('#lock-time');if(time)time.textContent=shortTime(now);const date=$('#lock-date');if(date)date.textContent=longDate(now);}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled||!state)return;
  const action=button.dataset.action,d=button.dataset;
  if(action==='unlock')unlock();
  else if(action==='app')go({app:d.app,tab:d.app==='kakao'?'chats':undefined,page:d.app==='instagram'?'feed':undefined});
  else if(action==='home')go({app:'home'});
  else if(action==='unavailable')toast(`${d.app==='safari'?'Safari':'相機'}暫未開放`);
  else if(action==='settings')openModal({kind:'settings',tab:'profile'});
  else if(action==='settings-tab')openModal({kind:'settings',tab:d.tab});
  else if(action==='settings-incoming')openModal({kind:'settings',tab:'incoming',member:modal?.member,channel:route.app==='kakao'?'kakao':'instagram'});
  else if(action==='close-modal')closeModal();
  else if(action==='weather')openModal({kind:'weather'});
  else if(action==='open-chat')go({app:d.channel==='kakao'?'kakao':'instagram',page:'chat',member:d.member});
  else if(action==='kakao-tab')go({app:'kakao',tab:d.tab});
  else if(action==='kakao-back')go({app:'kakao',tab:'chats'});
  else if(action==='dm-back')go({app:'instagram',page:'dm'});
  else if(action==='ig-tab')go({app:'instagram',page:d.tab});
  else if(action==='ig-saved')go({app:'instagram',page:'feed',saved:true});
  else if(action==='compose')showCompose();
  else if(action==='compose-story')showCompose('story');
  else if(action==='select-photo') {
    if(modal?.kind!=='compose')return;captureDraft();
    const index=modal.images.findIndex(x=>x.id===d.member);
    if(index>=0)modal.images.splice(index,1);
    else if(modal.type==='story')modal.images=[{...photos.find(p=>p.id===d.member)}];
    else if(modal.images.length<10)modal.images.push({...photos.find(p=>p.id===d.member)});
    else toast('一則貼文最多 10 張照片');renderModal();
  } else if(action==='remove-photo') {captureDraft();modal.images.splice(Number(d.index),1);renderModal();}
  else if(action==='upload-images') {$('#image-upload').value='';$('#image-upload').multiple=modal?.type!=='story';$('#image-upload').dataset.mode='compose';$('#image-upload').click();}
  else if(action==='upload-avatar') {$('#image-upload').value='';$('#image-upload').multiple=false;$('#image-upload').dataset.mode='avatar';$('#image-upload').click();}
  else if(action==='publish') {
    if(modal?.kind!=='compose'||!modal.images.length||inFlightUpload)return;
    captureDraft();publish(state,C,{type:modal.type,images:modal.images,caption:modal.caption||''});commit(false);const isStory=modal.type==='story';go({app:'instagram',page:'feed'});toast(isStory?'已分享到你的限時動態':'貼文已分享');
  } else if(action==='like') {
    const p=state.posts.find(x=>x.id===d.id);p.liked=!p.liked;p.likes=Math.max(0,p.likes+(p.liked?1:-1));commit();
  } else if(action==='bookmark') {
    const i=state.bookmarked.indexOf(d.id);if(i<0)state.bookmarked.push(d.id);else state.bookmarked.splice(i,1);commit();
  } else if(action==='slide')slidePost(d.id,Number(d.dir));
  else if(action==='comments')openModal({kind:'comments',postId:d.id});
  else if(action==='share-post')openModal({kind:'share-post',postId:d.id});
  else if(action==='send-post')sendSharedPost(d.id,d.member);
  else if(action==='view-post') {previousRoute={...route};go({app:'instagram',page:'post',postId:d.id,from:d.from});}
  else if(action==='post-back')go(previousRoute.app==='instagram'?previousRoute:{app:'instagram',page:'feed'});
  else if(action==='post-options')openModal({kind:'post-options',postId:d.id});
  else if(action==='photo')go({app:'photos',page:'detail',photo:d.member});
  else if(action==='photos-back')go({app:'photos'});
  else if(action==='photo-share')openModal({kind:'photo-share',member:d.member});
  else if(action==='photo-to-compose')showCompose(d.type,[photos.find(p=>p.member===d.member)]);
  else if(action==='photo-next')go({app:'photos',page:'detail',photo:photos[(photos.findIndex(p=>p.id===route.photo)+1)%5].id});
  else if(action==='story')openModal({kind:'story',member:d.member,index:0});
  else if(action==='story-next')nextStory();
  else if(action==='story-prev'){if(modal.index>0){modal.index--;renderStoryModal();}else closeModal();}
  else if(action==='story-pause') {const el=overlay.querySelector('.story-viewer');if(el.classList.toggle('story-paused')){clearTimeout(storyTimer);button.textContent='▶';button.setAttribute('aria-label','繼續限時動態');}else{renderStoryModal();}}
  else if(action==='story-reply')go({app:'instagram',page:'chat',member:d.member});
  else if(action==='phone-tab')go({app:'phone',tab:d.tab});
  else if(action==='contact')go({app:'phone',page:'contact',member:d.member});
  else if(action==='phone-back')go({app:'phone',tab:'contacts'});
  else if(action==='call-info')openModal({kind:'call-info',member:d.member});
  else if(action==='missed-calls')openModal({kind:'notice',title:'未接來電',text:'目前沒有未接來電。'});
  else if(action==='sms-thread')go({app:'sms',page:'chat',thread:d.id});
  else if(action==='sms-back')go({app:'sms'});
  else if(action==='search')openModal({kind:'search',channel:d.channel});
  else if(action==='chat-info')openModal({kind:'chat-info',member:d.member});
  else if(action==='chat-emoji'){const el=$('#chat-input');el.value+=' 🤍';el.focus();captureDraft();}
  else if(action==='chat-share')openModal({kind:'pick-post'});
  else if(action==='toast-open'){
    if(!toastAction)return;const n=toastAction;$('#toast').innerHTML='';clearTimeout(toastTimer);toastAction=null;
    if(n.postId){previousRoute={app:'instagram',page:'feed'};go({app:'instagram',page:'post',postId:n.postId});}else go({app:n.channel==='kakao'?'kakao':'instagram',page:'chat',member:n.member});
  } else if(action==='export-save')exportSave();
  else if(action==='import-save'){$('#save-upload').value='';$('#save-upload').click();}
  else if(action==='reset')openModal({kind:'reset'});
  else if(action==='confirm-reset'){state=createState(C);saveBroken=false;commit(false);go({app:'lock'});toast('已重新開始');}
});

document.addEventListener('submit',event=>{
  const id=event.target.id;
  if(!['chat-form','comment-form','profile-form','incoming-form'].includes(id))return;
  event.preventDefault();
  if(id==='chat-form') {
    const input=$('#chat-input'),text=input.value.trim();if(!text)return;
    const channel=route.app==='kakao'?'kakao':'instagram';addMessage(state,channel,route.member,text,'me');queueKeywordReplies(state,C,channel,route.member,text);input.value='';drafts[`${route.app}:${route.member}`]='';commit();
  } else if(id==='comment-form') {
    const text=$('#comment-input').value.trim();if(!text)return;const post=state.posts.find(p=>p.id===modal.postId);post.comments.push({id:uid(),author:'me',text,time:Date.now()});commit();renderModal();$('#comment-input')?.focus();
  } else if(id==='profile-form') {
    const name=$('#player-name').value.trim(),handle=$('#player-username').value.trim();if(!name||!handle)return;state.profile.name=name;state.profile.username=handle;state.profile.bio=$('#player-bio').value;commit();closeModal();toast('已儲存你的個人檔案');
  } else if(id==='incoming-form') {
    const channel=$('#incoming-channel').value,m=$('#incoming-member').value,text=$('#incoming-text').value.trim();if(!text)return;
    addMessage(state,channel,m,text);if(route.page==='chat'&&route.member===m&&((route.app==='kakao'&&channel==='kakao')||(route.app==='instagram'&&channel==='instagram')))markRead(channel,m);
    commit();closeModal();toast(text,{channel,member:m});
  }
});
document.addEventListener('input',event=>{
  const id=event.target.id;
  if(id==='chat-input'||id==='compose-caption')captureDraft();
  if(id==='contact-search'||id==='chat-search') {
    const query=event.target.value.trim().toLowerCase(),container=id==='contact-search'?$('#contact-list'):$('#chat-search-results');
    container?.querySelectorAll('[data-search-name]').forEach(el=>el.hidden=!el.dataset.searchName.includes(query));
  }
});
document.addEventListener('keydown',event=>{
  if(!state)return;
  if(event.key==='Escape'){if(modal)closeModal();else if(route.app!=='home'&&route.app!=='lock')go({app:'home'});}
  if(route.app==='lock'&&!modal&&['Enter','ArrowUp',' '].includes(event.key)&&!['INPUT','TEXTAREA','BUTTON'].includes(event.target.tagName)){event.preventDefault();unlock();}
  if(event.key==='Enter'&&event.target.matches('[role=button][data-action]'))event.target.click();
  if(event.key==='Tab'&&modal){const nodes=[...overlay.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]')].filter(el=>!el.hidden);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
root.addEventListener('pointerdown',event=>{if(event.target.closest('input,textarea,button[data-action="slide"]'))return;pointerStart={x:event.clientX,y:event.clientY,post:event.target.closest('[data-swipe-post]')?.dataset.swipePost,locked:route.app==='lock'};});
root.addEventListener('pointerup',event=>{if(!pointerStart)return;const p=pointerStart;pointerStart=null;if(p.locked&&p.y-event.clientY>35){unlock();return;}if(p.post&&Math.abs(p.x-event.clientX)>45&&Math.abs(p.y-event.clientY)<80)slidePost(p.post,event.clientX<p.x?1:-1);});
root.addEventListener('pointercancel',()=>pointerStart=null);
root.addEventListener('dblclick',event=>{const post=event.target.closest('[data-swipe-post]');if(!post)return;const p=state.posts.find(p=>p.id===post.dataset.swipePost);if(!p.liked){p.liked=true;p.likes++;commit();}});
root.addEventListener('click',event=>{if(route.app==='lock'&&!event.target.closest('[data-action]'))unlock();});
overlay.addEventListener('click',event=>{if(event.target===overlay)closeModal();});
$('#home-button').addEventListener('click',()=>{if(!state)return;if(route.app==='lock')unlock();else go({app:'home'});});
$('#power-button').addEventListener('click',()=>{if(!state)return;if(route.app==='lock')unlock();else go({app:'lock'});});
$('#settings-button').addEventListener('click',()=>state&&openModal({kind:'settings',tab:'profile'}));
$('#help-button').addEventListener('click',()=>state&&openModal({kind:'help'}));

async function readImage(file) {
  if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type))throw new Error('請選擇 JPG、PNG、WebP 或 GIF 圖片');
  if(file.size>20*1024*1024)throw new Error('單張圖片請小於 20 MB');
  const url=URL.createObjectURL(file);
  try {
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('這張圖片無法讀取'));i.src=url;});
    const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.85);
  } finally {URL.revokeObjectURL(url);}
}
$('#image-upload').addEventListener('change',async event=>{
  const files=[...event.target.files];if(!files.length)return;
  const mode=event.target.dataset.mode,activeModal=modal;
  if(mode==='compose'&&activeModal?.kind!=='compose')return;
  inFlightUpload=true;if(mode==='compose'){captureDraft();renderModal();}
  try {
    const capacity=mode==='avatar'?1:activeModal.type==='story'?1:10-activeModal.images.length;
    if(capacity<1){toast('一則貼文最多 10 張照片');return;}
    const processed=[];
    for(const file of files.slice(0,capacity))processed.push({id:uid(),src:await readImage(file),filename:file.name});
    if(mode==='avatar'){state.profile.avatar=processed[0].src;commit();toast('已更換你的頭貼');}
    else if(modal===activeModal){if(activeModal.type==='story')activeModal.images=processed.slice(0,1);else activeModal.images.push(...processed);}
    if(files.length>capacity)toast(`已選取前 ${capacity} 張照片`);
  } catch(error){toast(error.message);}
  finally{inFlightUpload=false;if(modal===activeModal)renderModal();}
});
function exportSave() {
  const blob=new Blob([JSON.stringify(saveBroken?originalBrokenSave:state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`itzy-phone-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('已匯出遊戲存檔');
}
$('#save-upload').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>80*1024*1024)throw new Error('存檔超過 80 MB，無法匯入');
    const imported=validateSave(JSON.parse(await file.text()),C);
    // 先存下目前進度，匯入成功後可由匯出檔復原。
    exportSave();await saveState(imported);state=imported;saveBroken=false;go({app:'home'});toast('已匯入存檔；匯入前的進度也已匯出備份');
  } catch(error){toast(error instanceof SyntaxError?'存檔不是有效的 JSON 格式':error.message);}
});

async function boot() {
  $('#signal').innerHTML=icon('signal');$('#wifi').innerHTML=icon('wifi');
  const loaded=await openStorage();
  try{state=loaded?validateSave(loaded,C):createState(C);}
  catch{state=createState(C);saveBroken=true;originalBrokenSave=loaded;}
  refresh();if(!loaded)persist();
  if(saveBroken)toast('原存檔無法讀取，請到遊戲設定查看');
  clockTimer=setInterval(updateClock,15000);
  setInterval(()=>{
    if(!state||saveBroken)return;
    const notices=runDueJobs(state,C);
    if(!notices.length)return;
    for(const n of notices)if(route.page==='chat'&&route.member===n.member&&((route.app==='kakao'&&n.channel==='kakao')||(route.app==='instagram'&&n.channel==='instagram')))markRead(n.channel,n.member);
    commit();
    const n=notices.at(-1);toast(n.text,n);
  },400);
}
boot();
