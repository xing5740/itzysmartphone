import {WEATHER_SOURCE,seoulDay,createWeatherClient} from './weather.js';
import {uid,splitChatText,createState,addMessage,queueKeywordReplies,queueEmojiReplies,publish,runDueJobs,unreadCount,validateSave,photoLibrary,personalize,completeOnboarding,startDialogue,dialogueChoices,chooseDialogue,addComment,toggleCommentLike,advancePostLikes,scheduleRandomDialogue} from './core.js';
import {openStorage,saveState,resetStorage} from './storage.js';
import {icon} from './icons.js';

const C=window.PHONE_CONFIG;
const $=selector=>document.querySelector(selector);
const root=$('#app'), overlay=$('#overlay'), screen=$('#screen');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const member=id=>C.members.find(m=>m.id===id);
const personName=id=>id==='me'?state.profile.name:member(id)?.name||state.fans?.[id]?.username||id;
const username=id=>id==='me'?state.profile.username:member(id)?.username||state.fans?.[id]?.username||id;
const instagramName=id=>member(id)?.displayName||personName(id);
const shortInstagramId=id=>{const value=username(id);return value.length>15?`${value.slice(0,15)}...`:value;};
const shortTime=time=>new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false}).format(time);
const longDate=time=>new Intl.DateTimeFormat('zh-TW',{month:'long',day:'numeric',weekday:'long'}).format(time);
const localDateStamp=time=>{const date=new Date(time);return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;};
const age=time=>{const mins=Math.max(0,Math.floor((Date.now()-time)/60000));return mins<1?'剛剛':mins<60?`${mins} 分鐘前`:mins<1440?`${Math.floor(mins/60)} 小時前`:`${Math.floor(mins/1440)} 天前`;};
const safeSrc=src=>typeof src==='string' && (/^(assets|photo|ins)\/[a-zA-Z0-9_/.\-]+$/.test(src)&&!src.includes('..') || /^data:image\/(jpeg|png|webp|gif);base64,/.test(src))?src:'assets/moment-yeji.svg';
function image(src,fallback,alt,classes='',alternates=[]) {return `<img src="${esc(safeSrc(src))}" alt="${esc(alt)}" class="${classes}" data-fallback="${esc(fallback)}" data-alternates="${esc(JSON.stringify(alternates))}" draggable="false">`;}
function avatar(id,classes='',phone=false,label=personName(id),channel='instagram') {
  const fan=state.fans?.[id];
  if(fan)return `<span class="avatar fan-avatar ${classes}" role="img" aria-label="${esc(fan.username)}" style="background:${esc(fan.color)}">${esc(fan.username[0].toUpperCase())}</span>`;
  const src=id==='me'?state.profile.avatar:(phone?C.assets.phoneAvatar(id):channel==='kakao'?C.assets.kakaoAvatar(id):C.assets.instagramAvatar(id));
  const alternatives=phone?[`${src}.jpeg`,`${src}.jpg`,`${src}.png`]:[];
  return image(src||'photo/ins/profile/me.jpeg',`assets/avatar-${id==='me'?'me':id}.svg`,label,`avatar ${classes}`,alternatives);
}
function photoImage(photo,classes='') {return image(photo.src,`assets/moment-${photo.member||'yeji'}.svg`,photo.member?`與 ${personName(photo.member)} 的${photo.side==='her'?'對應':'回憶'}照片`:'選擇的照片',classes);}
let photos=[];
const dialogue=text=>personalize(state,text);
let state;
let route={app:'lock'};
let modal=null, storyTimer, toastTimer, clockTimer, pointerStart=null;
let toastAction=null, previousRoute={app:'home'};
const drafts={};
let storageWarningShown=false, saveBroken=false, inFlightUpload=false, resetting=false;
const weatherClient=createWeatherClient(C.weather,{onUpdate:()=>{
  if(state&&['home','lock'].includes(route.app))refresh();
  if(modal?.kind==='weather')renderModal();
}});
function weatherView(){
  return weatherClient.data||{date:seoulDay(),temperature:'--',high:'--',low:'--',condition:['idle','loading'].includes(weatherClient.status)?'正在取得天氣':'暫時無法取得天氣',icon:'cloud',hours:Array.from({length:5},()=>({time:'—',temp:'--',condition:'',icon:'cloud'}))};
}


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
  const comment=$('#comment-input');if(comment&&modal?.kind==='comments')modal.draft=comment.value;
}
async function persist() {
  if(saveBroken||resetting)return;
  try {await saveState(state);}
  catch {if(!storageWarningShown){storageWarningShown=true;toast('瀏覽器無法儲存進度，請確認儲存空間與網站資料權限。');}}
}
function commit(render=true) {persist();if(render)refresh();}
function go(next) {
  captureDraft();
  if (modal) closeModal(false);
  route=state.onboardingComplete?{...next}:{app:'setup'};
  if(route.app==='instagram'&&advancePostLikes(state,C))persist();
  if(route.page==='chat'&&['kakao','instagram'].includes(route.app)){
    startDialogue(state,C,route.app,route.member);markRead(route.app,route.member);
  }
  refresh(true);
}
function markRead(channel,id){if(!state.chats[channel]?.[id])return;state.chats[channel][id].forEach(x=>x.read=true);persist();}
function unlock(){go({app:'home'});}
function refresh(navigating=false) {
  if(!navigating)captureDraft();
  photos=photoLibrary(state,C);
  const focus=snapshotFocus(root), oldScroll=root.querySelector('.scroll'), scrollTop=oldScroll?.scrollTop||0;
  screen.className=`screen app-${route.app}${route.page==='chat'?' is-chat':''}${modal?.kind==='story'?' has-story':''}`;
  $('#status-bar').classList.toggle('wallpaper-status',['lock','home'].includes(route.app));
  $('#home-button').disabled=route.app==='setup';
  root.className=`app-root ${route.app==='kakao'&&route.page==='chat'?'chat-bg':''} ${route.app==='instagram'&&route.page==='chat'?'ig-chat':''} ${route.app==='sms'&&route.page==='chat'?'sms-chat':''}`;
  if(route.app==='setup')root.innerHTML=renderSetup();
  else if(route.app==='lock')root.innerHTML=renderLock();
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
function renderSetup() {
  return `<section class="setup-screen"><div class="setup-heading">${icon('user')}<h1>設定你的手機</h1></div><form id="setup-form"><label class="field-label" for="setup-username">Instagram ID</label><div class="username-field"><span>@</span><input id="setup-username" value="${esc(state.profile.username)}" maxlength="31" autocomplete="username" autocapitalize="none" spellcheck="false" required aria-describedby="setup-error"></div><label class="field-label" for="setup-nickname">成員對你的稱呼</label><input class="text-field" id="setup-nickname" value="${esc(state.profile.nickname)}" placeholder="輸入稱呼" maxlength="40" autocomplete="nickname" required><p class="form-error" id="setup-error" role="alert"></p><button class="primary-button">開始</button></form><p class="setup-disclaimer">照片素材皆來自 ITZY 官方和成員帳號<br>部分對話與互動使用 AI 生成<br>使用 Cloudflare Web Analytics 統計網站流量</p></section>`;
}
function renderLock() {
  const w=weatherView();
  const notifications=['kakao','instagram'].map(channel=>({channel,count:unreadCount(state,channel)})).filter(x=>x.count>0);
  const notices=notifications.map(({channel,count})=>{
    const kakao=channel==='kakao',name=kakao?'KakaoTalk':'Instagram';
    return `<button class="lock-notice" data-action="${kakao?'kakao-tab':'ig-tab'}" data-tab="${kakao?'chats':'dm'}" aria-label="${name} ${count} 則通知"><span class="notice-app ${channel}">${icon(kakao?'chat':'instagram','',kakao)}</span><div><strong>${name}</strong><p>${count} 則通知</p></div></button>`;
  }).join('');
  return `<section class="lock-screen" id="lock-swipe" aria-label="鎖定畫面，往上滑或按 Enter 解鎖">${wallpaper('lock')}<button class="lock-open" data-action="unlock" aria-label="點一下解鎖"></button><div class="lock-icon">${icon('unlock')}</div><div class="lock-date" id="lock-date">${longDate(Date.now())}</div><div class="lock-time" id="lock-time">${shortTime(Date.now())}</div><div class="lock-subtitle">${icon(w.icon)} 首爾 · ${w.temperature}° · ${w.condition}</div>${notices?`<div class="lock-notifications">${notices}</div>`:''}</section>`;
}
function appIcon(name) {
  if(name==='kakao')return '<span class="app-icon icon-kakao"><span class="kakao-mark">TALK</span></span>';
  if(name==='instagram')return `<span class="app-icon icon-instagram">${icon('instagram')}</span>`;
  if(name==='photos')return `<span class="app-icon icon-photos"><span class="petals">${['#ef4f5c','#f99845','#f7d84d','#9cc45f','#4dc5b3','#4eafdf','#7779c2','#ce75b4'].map((c,i)=>`<i style="background:${c};transform:rotate(${i*45}deg)"></i>`).join('')}</span></span>`;
  if(name==='safari')return `<span class="app-icon icon-safari">${icon('safari','safari-dial')}</span>`;
  if(name==='settings')return `<span class="app-icon icon-settings">${icon('settings')}</span>`;
  return `<span class="app-icon icon-${name}">${icon(name==='sms'?'chat':name)}</span>`;
}
function tile(app,label,disabled=false) {
  const unread=['kakao','instagram'].includes(app)?unreadCount(state,app):0;
  return `<button class="app-tile" data-action="${disabled?'unavailable':'app'}" data-app="${app}" ${disabled?'disabled aria-disabled="true" title="暫未開放"':''} aria-label="${label}${disabled?'，暫未開放':''}"><span style="position:relative">${appIcon(app)}${unread?`<span class="app-badge">${unread>99?'99+':unread}</span>`:''}</span><span>${label}</span></button>`;
}
function renderHome() {
  const w=weatherView();
  return `<section class="home-screen">${wallpaper('home')}<div class="weather-widget" role="button" tabindex="0" data-action="weather" aria-label="首爾天氣，查看預報來源"><div class="weather-top"><span class="weather-city">首爾 <span style="font-size:10px;opacity:.7">서울</span></span><span class="weather-date" id="weather-date">${localDateStamp(Date.now())}</span></div><div class="weather-summary"><span class="weather-temp">${w.temperature}°</span><div class="weather-condition">${icon(w.icon)}${esc(w.condition)} · 最高 ${w.high}° 最低 ${w.low}°</div></div><div class="weather-hours">${w.hours.map(h=>`<div class="weather-hour"><span>${h.time}</span>${icon(h.icon)}<span>${h.temp}°</span></div>`).join('')}</div></div><div class="app-grid">${tile('kakao','KakaoTalk')}${tile('instagram','Instagram')}${tile('photos','照片')}${tile('settings','設定')}</div><div class="home-dock">${tile('phone','電話')}${tile('sms','訊息')}${tile('safari','Safari',true)}${tile('camera','相機',true)}</div></section>`;
}
function topbar(title,buttons='',backAction='home') {
  return `<header class="app-topbar"><button class="top-button header-back" data-action="${backAction}" aria-label="返回">${icon('back')}</button><h2 class="app-title" style="font-size:16px;text-align:center">${esc(title)}</h2>${buttons||'<span style="width:24px"></span>'}</header>`;
}
function kakaoNav(){return `<nav class="bottom-nav" aria-label="KakaoTalk 導覽"><button data-action="kakao-tab" data-tab="friends" class="${route.tab==='friends'?'active':''}">${icon('user', '',route.tab==='friends')}<span>好友</span></button><button data-action="kakao-tab" data-tab="chats" class="${route.tab!=='friends'?'active':''}"><span class="nav-icon-wrap">${icon('chat','',route.tab!=='friends')}${unreadCount(state,'kakao')?`<span class="app-badge">${unreadCount(state,'kakao')}</span>`:''}</span><span>聊天</span></button></nav>`;}
function renderKakao() {
  if(route.page==='chat')return renderChat('kakao',route.member);
  const friends=route.tab==='friends';
  return `<header class="app-topbar"><h2 class="app-title">${friends?'好友':'聊天'}</h2><button class="top-button" data-action="search" data-channel="kakao" aria-label="搜尋好友">${icon('search')}</button><button class="top-button" data-action="settings" aria-label="設定">${icon('more')}</button></header><div class="scroll">${friends?`<button class="list-row self-row" data-action="settings">${avatar('me','kakao-avatar')}<div class="list-row-copy"><strong>${esc(state.profile.name)}</strong></div></button><div class="section-label"><span>好友 ${C.members.length}</span><span>⌃</span></div>`:''}${(friends?C.members:chatMembers('kakao')).map(m=>renderChatRow('kakao',m,friends)).join('')}</div>${kakaoNav()}`;
}
function chatMembers(channel) {
  // 開場訊息時間相同時，沿用成員年齡順序；有收發訊息後依最後訊息時間排列。
  return [...C.members].sort((a,b)=>(state.chats[channel][b.id].at(-1)?.time??0)-(state.chats[channel][a.id].at(-1)?.time??0));
}
function renderChatRow(channel,m,friends=false) {
  const messages=state.chats[channel][m.id],latest=messages.at(-1),unread=unreadCount(state,channel,m.id);
  return `<button class="list-row" data-action="open-chat" data-channel="${channel}" data-member="${m.id}">${avatar(m.id,channel==='kakao'?'kakao-avatar':'',false,personName(m.id),channel)}<div class="list-row-copy"><strong>${channel==='instagram'?esc(instagramName(m.id)):m.name}</strong><p>${friends?m.korean:esc(latest?(latest.kind==='post'?'傳送了一則貼文':latest.sender==='me'?latest.text:dialogue(latest.text)):(channel==='instagram'?`${m.username} · 傳送訊息`:'尚無訊息'))}</p></div>${!friends?`<div class="list-row-meta"><span>${latest?shortTime(latest.time):''}</span>${unread?`<span class="unread-pill">${unread}</span>`:''}</div>`:'<span class="friend-status">♡</span>'}</button>`;
}
function renderDialogueChoices(channel,id) {
  const welcome=renderWelcomeChoice(channel,id);if(welcome)return welcome;
  const session=state.dialogueSessions[channel]?.[id];
  const choices=dialogueChoices(state,C,channel,id);
  if(!choices.length||C.dialogues[id]?.nodes[session?.nodeId]?.initial)return '';
  return `<div class="dialogue-choices" role="group" aria-label="選擇回覆">${choices.map(c=>`<button data-action="dialogue-choice" data-channel="${channel}" data-member="${id}" data-node="${esc(session.nodeId)}" data-choice="${esc(c.id)}">${esc(splitChatText(dialogue(c.text)).join(' '))}</button>`).join('')}</div>`;
}
function renderWelcomeChoice(channel,id) {
  const script=C.dialogues[id],node=script?.nodes[script.start];
  if(channel!=='kakao'||!C.dialogueChannels.includes(channel)||!node?.initial||state.welcomeDone?.[id]||state.welcomePending?.[id])return '';
  return `<div class="dialogue-choices welcome-choices" role="group" aria-label="回覆歡迎訊息">${node.choices.map(choice=>`<button data-action="dialogue-choice" data-channel="kakao" data-member="${id}" data-node="${script.start}" data-choice="${choice.id}">${esc(splitChatText(dialogue(choice.text)).join(' '))}</button>`).join('')}</div>`;
}
function renderChat(channel,id) {
  const m=member(id),messages=state.chats[channel][id];
  const quickHeart=channel==='kakao';
  const inputValue=drafts[`${channel==='kakao'?'kakao':'instagram'}:${id}`]||'';
  return `<header class="app-topbar"><button class="top-button header-back" data-action="${channel==='kakao'?'kakao-back':'dm-back'}" aria-label="返回聊天室列表">${icon('back')}</button>${channel==='instagram'?avatar(id,'small'):''}<div class="header-name"><strong>${channel==='kakao'?m.name:esc(instagramName(id))}</strong>${channel==='instagram'?`<small>${esc(m.username)}</small>`:''}</div><button class="top-button" data-action="chat-info" data-member="${id}" aria-label="聊天資訊">${icon('info')}</button></header><div class="scroll chat-log"><div class="chat-date">${longDate(messages[0]?.time||Date.now())}</div>${messages.length?messages.map(message=>renderMessage(message,channel,id)).join(''):`<div class="no-messages">${icon('chat')}<br>尚無訊息</div>`}${(state.dialogueSessions[channel]?.[id]?.pending||(channel==='kakao'&&state.welcomePending?.[id]))?`<div class="typing-indicator" aria-label="${m.name} 正在輸入"><i></i><i></i><i></i></div>`:''}</div>${renderDialogueChoices(channel,id)}<form class="chat-compose" id="chat-form">${channel==='instagram'?`<button type="button" data-action="chat-share" aria-label="分享貼文">${icon('image')}</button>`:''}<label class="sr-only" for="chat-input">傳送訊息</label><input id="chat-input" placeholder="${channel==='kakao'?'輸入訊息':'傳送訊息…'}" autocomplete="off" maxlength="2000" value="${esc(inputValue)}">${quickHeart?`<button type="button" class="quick-emoji" data-action="chat-heart" aria-label="傳送紅色愛心">${esc(C.kakaoEmoji.value)}</button>`:''}<button class="send-button" aria-label="傳送">${channel==='kakao'?icon('arrowUp'):'傳送'}</button></form>`;
}
function renderMessage(message,channel,id) {
  const mine=message.sender==='me';
  let body=esc(mine?message.text:dialogue(message.text));
  if(message.kind==='post') {
    const post=state.posts.find(p=>p.id===message.postId);
    body=post?`<button class="dm-shared-post" data-action="view-post" data-id="${post.id}">${photoImage(post.images[0])}<strong>${esc(username(post.author))}</strong><p>${esc(post.caption).slice(0,90)}</p></button>`:'這則貼文已不存在';
  }
  return `<div class="message-row ${mine?'mine':''}">${!mine?avatar(id,`small ${channel==='kakao'?'kakao-avatar':''}`,false,personName(id),channel):''}<div class="message-content">${!mine&&channel==='kakao'?`<div class="message-author">${personName(id)}</div>`:''}<div class="bubble-with-time"><div class="bubble ${message.kind==='post'?'dm-shared-post':''}">${body}</div><span class="message-time">${mine&&channel==='kakao'?'<span class="read">1</span>':''}${shortTime(message.time)}</span></div></div></div>`;
}
function instagramNav() {return `<nav class="bottom-nav" aria-label="Instagram 導覽"><button data-action="ig-tab" data-tab="feed" class="${!route.page||route.page==='feed'?'active':''}" aria-label="Instagram 首頁">${icon('home','',!route.page||route.page==='feed')}</button><button data-action="compose" aria-label="建立貼文">${icon('plus')}</button><button data-action="ig-tab" data-tab="profile" class="${route.page==='profile'?'active':''}" aria-label="我的個人檔案">${avatar('me','tiny')}</button></nav>`;}
function renderInstagram() {
  if(route.page==='chat')return renderChat('instagram',route.member);
  if(route.page==='dm')return `<header class="app-topbar"><button class="top-button header-back" data-action="ig-tab" data-tab="feed" aria-label="返回 Instagram 首頁">${icon('back')}</button><h2 class="app-title" style="font-size:17px">${esc(state.profile.username)}</h2><button class="top-button" data-action="search" data-channel="instagram" aria-label="搜尋訊息">${icon('search')}</button></header><div class="section-label"><span style="color:#222;font-weight:600">訊息</span><span>好友 ${C.members.length}</span></div><div class="scroll">${chatMembers('instagram').map(m=>renderChatRow('instagram',m)).join('')}</div>`;
  if(route.page==='profile')return renderProfile();
  if(route.page==='post') {
    const post=state.posts.find(p=>p.id===route.postId);
    return `${topbar('貼文','','post-back')}<div class="scroll">${post?renderPost(post):'<p class="list-empty">找不到貼文</p>'}</div>${instagramNav()}`;
  }
  return `<header class="app-topbar ig-topbar"><h2 class="ig-logo">Instagram</h2><button class="top-button" data-action="ig-saved" aria-label="珍藏貼文">${icon('bookmark')}</button><button class="top-button" style="position:relative" data-action="ig-tab" data-tab="dm" aria-label="私訊">${icon('send')}${unreadCount(state,'instagram')?'<span class="notification-dot"></span>':''}</button></header><div class="scroll"><div class="story-tray">${renderStoryTray()}</div>${route.saved?`<div class="section-label"><span>珍藏貼文</span><button data-action="ig-tab" data-tab="feed">顯示全部</button></div>`:''}${(route.saved?state.posts.filter(p=>state.bookmarked.includes(p.id)):state.posts).map(renderPost).join('')||`<div class="feed-empty"><div class="empty-decoration">${icon('camera')}</div><h3>${route.saved?'沒有珍藏的貼文':'尚無貼文'}</h3><button class="text-action" data-action="${route.saved?'ig-tab':'compose'}" data-tab="feed">${route.saved?'回到首頁':'新增貼文'}</button></div>`}</div>${instagramNav()}`;
}
function activeStories(id){return state.stories.filter(s=>s.author===id&&(Date.now()-s.createdAt<86400000));}
function renderStoryTray() {
  const own=activeStories('me');
  return `<div class="story-avatar"><div class="story-avatar-photo"><button class="story-open" data-action="${own.length?'story':'compose-story'}" data-member="me" aria-label="${own.length?'觀看你的限時動態':'發佈限時動態'}"><span class="story-ring ${!own.length?'empty':own.every(s=>s.seen)?'seen':''}">${avatar('me')}</span></button><button class="story-add" data-action="compose-story" aria-label="新增限時動態">${icon('plus')}</button></div><span>你的限時動態</span></div>${C.members.map(m=>{const stories=activeStories(m.id);return `<button class="story-avatar" data-action="story" data-member="${m.id}" aria-label="觀看 ${esc(m.username)} 的限時動態"><span class="story-ring ${!stories.length?'empty':stories.every(s=>s.seen)?'seen':''}">${avatar(m.id)}</span><span class="story-username" title="${esc(m.username)}">${esc(shortInstagramId(m.id))}</span></button>`;}).join('')}`;
}
function renderPostLikes(post){
  if(!post.likes)return '';
  const likers=(post.memberLikes||[]).filter(id=>member(id));
  return `<div class="post-likes">${likers.length?`<span class="post-member-likes">${likers.map(id=>esc(username(id))).join('、')} 說讚</span> · `:''}${post.likes.toLocaleString()} 個讚</div>`;
}
function renderPost(post) {
  const count=post.images.length,slide=Math.max(0,Math.min(post.slide||0,count-1));
  return `<article class="post" data-post="${post.id}"><header class="post-header">${avatar(post.author)}<div class="post-username">${esc(username(post.author))}</div><button class="top-button" data-action="post-options" data-id="${post.id}" aria-label="貼文選項">${icon('more')}</button></header><div class="post-image-wrap" data-swipe-post="${post.id}">${photoImage(post.images[slide],'post-image')}${count>1?`<span class="slide-count">${slide+1}/${count}</span>${slide>0?`<button class="slide-arrow prev" data-action="slide" data-id="${post.id}" data-dir="-1" aria-label="上一張">${icon('back')}</button>`:''}${slide<count-1?`<button class="slide-arrow next" data-action="slide" data-id="${post.id}" data-dir="1" aria-label="下一張">${icon('chevron')}</button>`:''}`:''}</div><div class="post-actions"><button data-action="like" data-id="${post.id}" class="${post.liked?'liked':''}" aria-label="${post.liked?'取消按讚':'按讚'}">${icon('heart','',post.liked)}</button><button data-action="comments" data-id="${post.id}" aria-label="留言">${icon('chat')}</button><button data-action="share-post" data-id="${post.id}" aria-label="傳送貼文到聊天室">${icon('send')}</button>${count>1?`<span class="slide-dots">${post.images.map((_,i)=>`<i class="${i===slide?'active':''}"></i>`).join('')}</span>`:''}<button data-action="bookmark" data-id="${post.id}" aria-label="${state.bookmarked.includes(post.id)?'取消珍藏':'珍藏貼文'}">${icon('bookmark','',state.bookmarked.includes(post.id))}</button></div><div class="post-details">${renderPostLikes(post)}<div class="post-caption"><strong>${esc(username(post.author))}</strong>${esc(post.caption).replaceAll('\n','<br>')}</div><button class="comment-preview" data-action="comments" data-id="${post.id}">${post.comments.length?`查看全部 ${post.comments.length} 則留言`:'新增留言…'}</button><div class="post-date">${age(post.time)}</div></div></article>`;
}
function renderProfile() {
  const posts=state.posts.filter(p=>p.author==='me');
  return `<header class="app-topbar"><h2 class="app-title" style="font-size:18px">${esc(state.profile.username)}</h2><button class="top-button" data-action="compose" aria-label="新增貼文">${icon('plus')}</button><button class="top-button" data-action="settings" aria-label="個人設定">${icon('more')}</button></header><div class="scroll"><div class="profile-info"><div class="profile-stats">${avatar('me','large')}<div class="profile-numbers"><div><strong>${posts.length}</strong>貼文</div><div><strong>5</strong>粉絲</div><div><strong>5</strong>追蹤中</div></div></div><div class="profile-bio"><strong>${esc(state.profile.name)}</strong>${esc(state.profile.bio)}</div><button class="profile-edit" data-action="settings">編輯個人檔案</button></div><div class="profile-tabs"><span class="active">${icon('grid')}</span><span style="color:#ccc">${icon('user')}</span></div>${posts.length?`<div class="profile-grid">${posts.map(p=>`<button data-action="view-post" data-id="${p.id}" data-from="profile" aria-label="查看我的貼文">${photoImage(p.images[0])}${p.images.length>1?icon('layers'):''}</button>`).join('')}</div>`:`<div class="feed-empty"><div class="empty-decoration">${icon('camera')}</div><h3>尚無貼文</h3><button class="text-action" data-action="compose">新增貼文</button></div>`}</div>${instagramNav()}`;
}
function renderPhotos() {
  if(route.page==='detail') {
    const photo=photos.find(p=>p.id===route.photo),index=photos.indexOf(photo);
    if(!photo)return '';
    return `<div class="photo-full">${topbar(`${photo.daysAgo}天前`,'','photos-back')}<div class="photo-full-image">${photoImage(photo)}</div><div class="photo-full-info"><label class="sr-only" for="photo-description">照片說明</label><textarea id="photo-description" class="photo-description" maxlength="1000" rows="2" placeholder="加入說明">${esc(photo.description)}</textarea></div><div class="photo-toolbar"><button data-action="photo-share" data-member="${photo.member}" aria-label="分享照片">${icon('share')}</button><div class="photo-navigation"><button data-action="photo-prev" aria-label="上一張照片" ${index===0?'disabled':''}>${icon('back')}</button><span class="photo-position">${index+1} / ${photos.length}</span><button data-action="photo-next" aria-label="下一張照片" ${index===photos.length-1?'disabled':''}>${icon('chevron')}</button></div></div></div>`;
  }
  return `<div class="photos-title"><h2>照片</h2></div><div class="scroll"><div class="photos-grid">${photos.map(p=>`<button class="photo-tile" data-action="photo" data-member="${p.member}" aria-label="${p.daysAgo}天前的照片">${photoImage(p)}<span class="photo-tile-label">${p.daysAgo}天前</span></button>`).join('')}</div><p class="photo-count">${photos.length} 張照片</p></div><nav class="bottom-nav"><button class="active" aria-current="page">${icon('image')}圖庫</button></nav>`;
}
function navigatePhoto(direction) {
  const index=photos.findIndex(p=>p.id===route.photo),photo=photos[index+direction];
  if(photo)go({app:'photos',page:'detail',photo:photo.id});
}
function renderPhone() {
  if(route.page==='contact') {
    const m=member(route.member);
    return `${topbar('聯絡人','','phone-back')}<div class="scroll contact-detail">${avatar(m.id,'',true)}<h2>${m.name}</h2><p>${m.korean}</p><div class="contact-buttons"><button data-action="open-chat" data-channel="kakao" data-member="${m.id}">${icon('chat')}訊息</button><button disabled title="暫未開放撥號">${icon('phone')}通話</button><button data-action="open-chat" data-channel="instagram" data-member="${m.id}">${icon('instagram')}Instagram</button></div><div class="contact-field">聯絡方式<span>KakaoTalk · ${m.name}</span></div></div>`;
  }
  const tab=route.tab||'recent';
  const content=tab==='contacts'?`<h2 class="phone-title">聯絡人</h2><div class="search-box">${icon('search')}<input id="contact-search" placeholder="搜尋聯絡人" aria-label="搜尋聯絡人"></div><div class="scroll" id="contact-list">${C.members.map(m=>`<button class="list-row" data-action="contact" data-member="${m.id}" data-search-name="${m.name.toLowerCase()} ${m.korean}">${avatar(m.id,'small',true)}<div class="list-row-copy"><strong>${m.name}</strong></div>${icon('chevron')}</button>`).join('')}</div>`:tab==='keypad'?`<h2 class="phone-title">撥號鍵盤</h2><div class="scroll"><div class="keypad">${['1','2','3','4','5','6','7','8','9','*','0','#'].map((x,i)=>`<button disabled>${x}<small>${['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ','','+',''][i]}</small></button>`).join('')}<span></span><button class="call-key" disabled aria-label="撥號暫未開放">${icon('phone')}</button></div></div>`:`<h2 class="phone-title">通話記錄</h2><div class="ios-tabs"><button class="active" aria-current="true">全部</button><button data-action="missed-calls">未接來電</button></div><div class="scroll">${C.members.map((m,i)=>`<div class="call-row"><span class="call-direction">${icon('phone')}</span>${avatar(m.id,'small',true)}<div class="call-row-copy"><strong>${m.name}</strong><small>${i%2?'撥出':'來電'} · ${['12 分 08 秒','5 分 32 秒','28 分 14 秒','8 分 46 秒','17 分 02 秒'][i]}</small></div><time>${['今天','昨天','星期四','星期三','星期二'][i]}</time><button class="info-button" data-action="call-info" data-member="${m.id}" aria-label="${m.name} 的通話資訊">${icon('info')}</button></div>`).join('')}</div>`;
  return `${content}<nav class="bottom-nav phone-bottom">${[['recent','clock','通話記錄'],['contacts','user','聯絡人'],['keypad','grid','鍵盤']].map(([id,ic,label])=>`<button class="${tab===id?'active':''}" data-action="phone-tab" data-tab="${id}">${icon(ic)}${label}</button>`).join('')}</nav>`;
}
function renderSMS() {
  if(route.page==='chat'){
    const thread=C.sms.find(x=>x.id===route.thread);
    return `${topbar(thread.name,'','sms-back')}<div class="scroll chat-log"><div class="chat-date">${thread.time}</div>${thread.messages.flatMap(splitChatText).map(text=>`<div class="message-row"><div class="message-content"><div class="bubble">${esc(text)}</div></div></div>`).join('')}</div><div class="sms-readonly">系統通知簡訊 · 無法回覆</div>`;
  }
  return `<h2 class="sms-title">訊息</h2><div class="scroll">${C.sms.map(t=>`<button class="list-row sms-row" data-action="sms-thread" data-id="${t.id}"><div class="sms-icon">${icon('user')}</div><div class="list-row-copy"><strong>${esc(t.name)}</strong><p>${esc(splitChatText(t.messages[0])[0]||'')}</p></div><div class="list-row-meta"><span>${t.time}</span>${icon('chevron')}</div></button>`).join('')}</div>`;
}

function sheet(title,body,footer='',className='',backAction='close-modal') {return `<section class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><span class="sheet-handle"></span><header class="sheet-header"><button data-action="${backAction}" aria-label="${backAction==='close-modal'?'關閉':'返回'}">${icon(backAction==='close-modal'?'close':'back')}</button><h2>${esc(title)}</h2><span style="width:20px"></span></header><div class="sheet-scroll">${body}</div>${footer}</section>`;}
function renderComment(post,c) {
  const likers=c.likedBy||[],liked=likers.includes('me'),target=post.comments.find(x=>x.id===c.replyTo);
  const mention=target?`@${username(target.author)}`:'';
  return `<div class="comment-row" data-comment-id="${c.id}">${avatar(c.author,'small',false,username(c.author))}<div class="comment-content"><div class="comment-text"><strong>${esc(username(c.author))}</strong>${mention&&!c.text.startsWith(mention)?`<span class="comment-mention">${esc(mention)}</span> `:''}${esc(c.text)}</div><div class="comment-meta"><time>${age(c.time)}</time>${likers.length?`<span class="comment-like-count">${likers.length} 個讚</span>`:''}<button data-action="reply-comment" data-id="${post.id}" data-comment="${c.id}">回覆</button></div></div><button class="comment-heart ${liked?'liked':''}" data-action="like-comment" data-id="${post.id}" data-comment="${c.id}" aria-pressed="${liked}" aria-label="${liked?'取消對':'對'} ${esc(username(c.author))} 的留言按讚">${icon('heart','',liked)}</button></div>`;
}
function renderCommentThreads(post) {
  return post.comments.filter(c=>!c.parentId).map(c=>{
    const replies=post.comments.filter(r=>r.parentId===c.id),expanded=modal.expandedThreads?.includes(c.id);
    return `<div class="comment-thread">${renderComment(post,c)}${replies.length?`<button class="thread-toggle" data-action="toggle-replies" data-comment="${c.id}" aria-expanded="${!!expanded}"><span></span>${expanded?'隱藏回覆':`查看 ${replies.length} 則回覆`}</button>${expanded?`<div class="comment-replies">${replies.map(r=>renderComment(post,r)).join('')}</div>`:''}`:''}</div>`;
  }).join('')||'<p class="comments-empty">尚無留言</p>';
}
function renderCommentsModal() {
  const post=state.posts.find(p=>p.id===modal.postId),target=post.comments.find(c=>c.id===modal.replyTo);
  const footer=`${target?`<div class="comment-replying"><span>正在回覆 @${esc(username(target.author))}</span><button data-action="cancel-comment-reply" aria-label="取消回覆">${icon('close')}</button></div>`:''}<form class="chat-compose" id="comment-form">${avatar('me','tiny',false,username('me'))}<input id="comment-input" placeholder="${target?`回覆 @${esc(username(target.author))}…`:'新增留言…'}" maxlength="1000" autocomplete="off" aria-label="留言內容"><button style="color:#6f89b2;font-size:11px">發佈</button></form>`;
  overlay.innerHTML=sheet('留言',`<div class="comment-row post-caption-row">${avatar(post.author,'small',false,username(post.author))}<div class="comment-content"><strong>${esc(username(post.author))}</strong>${esc(post.caption)}<small>${age(post.time)}</small></div></div><div class="comment-divider"></div>${renderCommentThreads(post)}`,footer,'comments-sheet');
}
function openModal(value) {
  captureDraft();clearTimeout(storyTimer);
  modal=value;renderModal();
  requestAnimationFrame(()=>{const target=overlay.querySelector('input:not([type=file]),textarea,button');target?.focus({preventScroll:true});});
}
function closeModal(render=true) {captureDraft();clearTimeout(storyTimer);modal=null;overlay.innerHTML='';screen.classList.remove('has-story');if(render)refresh();}
function renderModal() {
  if (!modal){overlay.innerHTML='';return;}
  const focus=snapshotFocus(overlay),scrollTop=overlay.querySelector('.sheet-scroll')?.scrollTop||0;
  const type=modal.kind;
  const commentDraft=type==='comments'?($('#comment-input')?.value??modal.draft??''):undefined;
  screen.classList.toggle('has-story',type==='story');
  if(type==='compose') {
    const isStory=modal.type==='story',selected=modal.images;
    overlay.innerHTML=sheet(isStory?'新增限時動態':'新增貼文',`<span class="sheet-section-label">最近項目</span><div class="sheet-photo-grid">${photos.map(p=>{const index=selected.findIndex(x=>x.id===p.id);return `<button class="sheet-photo-choice ${index>=0?'selected':''}" data-action="select-photo" data-member="${p.member}" aria-label="${index>=0?'取消選擇':'選擇'} ${personName(p.member)} 的照片">${photoImage(p)}<span class="selection-number">${index>=0?index+1:''}</span></button>`;}).join('')}</div><button class="upload-button" data-action="upload-images" aria-describedby="compose-upload-privacy" ${inFlightUpload?'disabled':''}>${icon('plus')}${inFlightUpload?'正在處理照片…':'從裝置選擇照片'}</button><p class="settings-note" id="compose-upload-privacy">所有上傳的照片只會保存在本地瀏覽器</p>${selected.length?`<div class="compose-preview">${selected.map((p,i)=>`<button data-action="remove-photo" data-index="${i}" aria-label="移除第 ${i+1} 張照片">${photoImage(p)}<span class="remove-image">×</span></button>`).join('')}</div>`:''}<p class="compose-count">已選 ${selected.length} / 1 張${isStory?' · 顯示 24 小時':''}</p>${!isStory?`<label class="field-label" for="compose-caption">說明</label><textarea class="text-field" id="compose-caption" rows="3" maxlength="2200" placeholder="撰寫說明…">${esc(modal.caption||'')}</textarea>`:''}<button class="primary-button" data-action="publish" ${!selected.length||inFlightUpload?'disabled':''}>${icon(isStory?'plus':'share')} ${isStory?'分享到限時動態':'分享貼文'}</button>`);
  } else if(type==='photo-share'){
    overlay.innerHTML=sheet('分享照片',`<div style="width:64px;height:64px;margin:0 auto 15px">${photoImage(photos.find(p=>p.member===modal.member),'post-image')}</div>${[['post','Instagram 貼文',''],['story','限時動態','']].map(([type,title,note])=>`<button class="share-choice" data-action="photo-to-compose" data-type="${type}" data-member="${modal.member}">${icon(type==='post'?'instagram':'plus')}<div><strong>${title}</strong><small>${note}</small></div>${icon('chevron')}</button>`).join('')}`);
  } else if(type==='comments') {
    renderCommentsModal();
  } else if(type==='share-post') {
    const post=state.posts.find(p=>p.id===modal.postId);
    overlay.innerHTML=sheet('傳送貼文',`${C.members.map(m=>`<button class="share-recipient" data-action="send-post" data-member="${m.id}" data-id="${post.id}">${avatar(m.id)}<div><strong>${esc(instagramName(m.id))}</strong><small>${esc(m.username)}</small></div><span class="share-send">傳送</span></button>`).join('')}`);
  } else if(type==='story') renderStoryModal();
  else if(type==='settings')renderSettings();
  else if(type==='weather') {
    const w=weatherView();
    const updated=weatherClient.updatedAt&&weatherClient.data?`更新：${localDateStamp(weatherClient.updatedAt)} ${shortTime(weatherClient.updatedAt)}`:'等待取得最新天氣';
    overlay.innerHTML=sheet('首爾天氣',`<div class="weather-detail"><h3>首爾 서울</h3>${icon(w.icon)}<div class="weather-temp">${w.temperature}°</div><p>${esc(w.condition)} · 最高 ${w.high}° 最低 ${w.low}°</p></div><p class="settings-note">${updated}${weatherClient.status==='error'?'<br>更新失敗，請稍後再試':''}</p><a class="link-source" href="${WEATHER_SOURCE}" target="_blank" rel="noreferrer">天氣資料：Open-Meteo（CC BY 4.0）↗</a>`);
  } else if(type==='search') {
    overlay.innerHTML=sheet(modal.channel==='kakao'?'搜尋好友':'搜尋訊息',`<div class="search-box" style="margin:0 0 8px">${icon('search')}<input id="chat-search" placeholder="輸入好友名稱或帳號" aria-label="搜尋好友"></div><div id="chat-search-results">${chatMembers(modal.channel).map(m=>`<div data-search-name="${esc(`${m.name} ${m.username} ${m.korean}`.toLowerCase())}">${renderChatRow(modal.channel,m)}</div>`).join('')}</div>`);
  } else if(type==='chat-info') {
    const m=member(modal.member);
    overlay.innerHTML=sheet('聊天資訊',`<div style="text-align:center">${avatar(m.id,'large',false,personName(m.id),route.app==='kakao'?'kakao':'instagram')}<h3 style="font-size:15px">${route.app==='instagram'?esc(instagramName(m.id)):m.name} · ${m.korean}</h3><p style="font-size:11px;color:#999">@${esc(m.username)}</p></div>`);
  } else if(type==='call-info'){
    const i=C.members.findIndex(m=>m.id===modal.member),m=member(modal.member);
    overlay.innerHTML=sheet('通話詳細資訊',`<div class="contact-detail" style="padding:12px">${avatar(m.id,'large',true)}<h2>${m.name}</h2><div class="contact-field">${['今天','昨天','星期四','星期三','星期二'][i]}<span>${i%2?'撥出電話':'來電'} · ${['12 分 08 秒','5 分 32 秒','28 分 14 秒','8 分 46 秒','17 分 02 秒'][i]}</span></div><button class="secondary-button" data-action="contact" data-member="${m.id}">查看聯絡人</button></div>`);
  } else if(type==='notice')overlay.innerHTML=sheet(modal.title,`<p class="sheet-description">${esc(modal.text)}</p><button class="primary-button" data-action="close-modal">知道了</button>`);
  else if(type==='reset')overlay.innerHTML=sheet('重新開始？',`<p class="sheet-description">將清除這個瀏覽器的聊天、貼文、限動與照片事件進度，並重新設定你的手機。</p><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button danger" data-action="confirm-reset">重新開始</button>`);
  else if(type==='post-options')overlay.innerHTML=sheet('貼文選項',`<button class="share-choice" data-action="share-post" data-id="${modal.postId}">${icon('send')}<strong>傳送到聊天室</strong></button>`);
  else if(type==='pick-post')overlay.innerHTML=sheet('選擇要分享的貼文',`${state.posts.map(p=>`<button class="share-choice" data-action="send-post" data-id="${p.id}" data-member="${route.member}"><span style="width:47px;height:47px">${photoImage(p.images[0],'post-image')}</span><div><strong>${esc(username(p.author))}</strong><small>${esc(p.caption).slice(0,50)||'照片貼文'}</small></div>${icon('send')}</button>`).join('')||'<p class="sheet-description">尚無貼文</p>'}`);
  if(type!=='story'){if(commentDraft!==undefined&&$('#comment-input'))$('#comment-input').value=commentDraft;const scroll=overlay.querySelector('.sheet-scroll');if(scroll)scroll.scrollTop=scrollTop;restoreFocus(focus);}
}

function renderSettings() {
  const content=`<form id="profile-form"><label class="field-label" for="player-name">名字</label><input class="text-field" id="player-name" value="${esc(state.profile.name)}" maxlength="40" required><label class="field-label" for="player-username">Instagram ID</label><input class="text-field" id="player-username" value="${esc(state.profile.username)}" maxlength="30" autocapitalize="none" spellcheck="false" required><label class="field-label" for="player-nickname">成員對你的稱呼</label><input class="text-field" id="player-nickname" value="${esc(state.profile.nickname)}" maxlength="40" required><label class="field-label" for="player-bio">個人簡介</label><textarea class="text-field" id="player-bio" rows="3" maxlength="150">${esc(state.profile.bio)}</textarea><button type="button" class="secondary-button" data-action="upload-avatar" aria-describedby="avatar-upload-privacy">更換頭貼</button><p class="settings-note" id="avatar-upload-privacy">所有上傳的照片只會保存在本地瀏覽器</p><button class="primary-button">儲存</button></form><button class="secondary-button" data-action="lock-phone">鎖定螢幕</button><button class="secondary-button" data-action="reset" style="color:#b16c74">重新開始</button>`;
  overlay.innerHTML=sheet('設定',`${saveBroken?'<p class="error-note">原存檔無法讀取。重新開始會清除這個瀏覽器的進度。</p>':''}${content}`);
}
function renderStoryModal() {
  let stories=activeStories(modal.member);
  if(!stories.length){closeModal(false);toast('目前沒有可觀看的限時動態');return;}
  modal.index=Math.max(0,Math.min(modal.index||0,stories.length-1));
  const s=stories[modal.index];s.seen=true;persist();
  overlay.innerHTML=`<section class="story-viewer" role="dialog" aria-modal="true" aria-label="${esc(username(s.author))} 的限時動態"><div class="story-bars">${stories.map((_,i)=>`<span class="${i<modal.index?'done':i===modal.index?'current':''}"><i></i></span>`).join('')}</div><header class="story-heading">${avatar(s.author,'small')}<div><strong title="${esc(username(s.author))}">${esc(shortInstagramId(s.author))}</strong><small>${age(s.createdAt)}</small></div><button data-action="story-pause" aria-label="暫停限時動態">Ⅱ</button><button data-action="close-modal" aria-label="關閉限時動態">${icon('close')}</button></header><div class="story-picture">${image(s.src,`assets/moment-${s.author==='me'?'yeji':s.author}.svg`,'限時動態照片')}<div class="story-tap"><button data-action="story-prev" aria-label="上一則限時動態"></button><button data-action="story-next" aria-label="下一則限時動態"></button></div></div><footer class="story-footer"><span>${s.author==='me'?'你的限時動態':''}</span>${s.author!=='me'?`<button data-action="story-reply" data-member="${s.author}">傳送訊息 ${icon('send')}</button>`:'<button data-action="compose-story">新增 ＋</button>'}</footer></section>`;
  clearTimeout(storyTimer);storyTimer=setTimeout(nextStory,6000);
}
function nextStory(){if(modal?.kind!=='story')return;const stories=activeStories(modal.member);if(modal.index+1<stories.length){modal.index++;renderStoryModal();}else closeModal();}
function toast(text,notice=null) {
  clearTimeout(toastTimer);toastAction=notice;
  $('#toast').innerHTML=notice?`<button class="toast" data-action="toast-open">${avatar(notice.member,'small',false,personName(notice.member),notice.channel==='kakao'?'kakao':'instagram')}<div><strong>${esc(notice.channel==='instagram'?instagramName(notice.member):personName(notice.member))} · ${notice.postId?'Instagram':notice.channel==='kakao'?'KakaoTalk':'Instagram'}</strong><p>${esc(dialogue(text))}</p></div></button>`:`<div class="toast toast-simple">${esc(text)}</div>`;
  toastTimer=setTimeout(()=>{$('#toast').innerHTML='';toastAction=null;},notice?5200:3000);
}
function showCompose(type='post',selected=[]) {openModal({kind:'compose',type,images:selected.slice(0,1).map(p=>({...p})),caption:selected.length?(state.photoDetails[selected[0].id]?.description||''):''});}
function slidePost(id,dir){const p=state.posts.find(p=>p.id===id);if(!p)return;p.slide=Math.max(0,Math.min((p.slide||0)+dir,p.images.length-1));commit();}
function sendSharedPost(id,recipient) {
  const post=state.posts.find(p=>p.id===id);if(!post)return;
  addMessage(state,'instagram',recipient,'傳送了一則貼文','me',Date.now(),{kind:'post',postId:id});
  commit(false);go({app:'instagram',page:'chat',member:recipient});toast(`已將貼文傳送給 ${personName(recipient)}`);
}
function updateClock(){const now=Date.now();$('#status-time').textContent=shortTime(now);const time=$('#lock-time');if(time)time.textContent=shortTime(now);const date=$('#lock-date');if(date)date.textContent=longDate(now);const weatherDate=$('#weather-date');if(weatherDate)weatherDate.textContent=localDateStamp(now);}
function updatePostEngagement(now=Date.now()) {
  if(!state||saveBroken||resetting||!advancePostLikes(state,C,now))return;
  persist();
  if(route.app==='instagram'&&(!route.page||['feed','post'].includes(route.page)))refresh();
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&state){updateClock();updatePostEngagement();processJobs();weatherClient.refresh();}
});

window.addEventListener('online',()=>weatherClient.refresh({force:true}));

async function restartGame(button) {
  if(resetting)return;
  resetting=true;button.disabled=true;button.textContent='正在重新開始…';
  const fresh=createState(C);
  try {
    await resetStorage(fresh);
    closeModal(false);
    for(const key of Object.keys(drafts))delete drafts[key];
    clearTimeout(toastTimer);$('#toast').innerHTML='';toastAction=null;
    pointerStart=null;homeGesture=null;inFlightUpload=false;
    $('#image-upload').value='';
    state=fresh;saveBroken=false;storageWarningShown=false;
    previousRoute={app:'home'};route={app:'setup'};refresh(true);
  }catch{
    button.disabled=false;button.textContent='重新開始';
    toast('無法儲存重置結果，請確認瀏覽器允許儲存網站資料後再試。');
  }finally{resetting=false;}
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled||!state||resetting)return;
  if(!state.onboardingComplete)return;
  const action=button.dataset.action,d=button.dataset;
  if(action==='unlock')unlock();
  else if(action==='app'){if(d.app==='settings')openModal({kind:'settings'});else go({app:d.app,tab:d.app==='kakao'?'chats':undefined,page:d.app==='instagram'?'feed':undefined});}
  else if(action==='home')go({app:'home'});
  else if(action==='unavailable')toast(`${d.app==='safari'?'Safari':'相機'}暫未開放`);
  else if(action==='settings')openModal({kind:'settings'});
  else if(action==='lock-phone')go({app:'lock'});
  else if(action==='close-modal')closeModal();
  else if(action==='weather')openModal({kind:'weather'});
  else if(action==='open-chat')go({app:d.channel==='kakao'?'kakao':'instagram',page:'chat',member:d.member});
  else if(action==='dialogue-choice'){
    if(route.app!==d.channel||route.member!==d.member||route.page!=='chat')return;
    try{if(chooseDialogue(state,C,d.channel,d.member,d.node,d.choice))commit();}catch(error){toast(error.message);}
  }
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
    else modal.images=[{...photos.find(p=>p.id===d.member)}];
    renderModal();
  } else if(action==='remove-photo') {captureDraft();modal.images.splice(Number(d.index),1);renderModal();}
  else if(action==='upload-images') {$('#image-upload').value='';$('#image-upload').multiple=false;$('#image-upload').dataset.mode='compose';$('#image-upload').click();}
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
  else if(action==='like-comment'){
    if(toggleCommentLike(state,d.id,d.comment)){commit();renderModal();}
  }
  else if(action==='reply-comment'){
    if(modal?.kind!=='comments'||modal.postId!==d.id)return;
    const comment=state.posts.find(p=>p.id===d.id)?.comments.find(c=>c.id===d.comment);if(!comment)return;
    modal.replyTo=comment.id;modal.expandedThreads=[...new Set([...(modal.expandedThreads||[]),comment.parentId||comment.id])];renderModal();$('#comment-input')?.focus();
  }
  else if(action==='cancel-comment-reply'){modal.replyTo=null;renderModal();$('#comment-input')?.focus();}
  else if(action==='toggle-replies'){
    const expanded=new Set(modal.expandedThreads||[]);if(expanded.has(d.comment))expanded.delete(d.comment);else expanded.add(d.comment);modal.expandedThreads=[...expanded];renderModal();
  }
  else if(action==='share-post')openModal({kind:'share-post',postId:d.id});
  else if(action==='send-post')sendSharedPost(d.id,d.member);
  else if(action==='view-post') {previousRoute={...route};go({app:'instagram',page:'post',postId:d.id,from:d.from});}
  else if(action==='post-back')go(previousRoute.app==='instagram'?previousRoute:{app:'instagram',page:'feed'});
  else if(action==='post-options')openModal({kind:'post-options',postId:d.id});
  else if(action==='photo')go({app:'photos',page:'detail',photo:d.member});
  else if(action==='photos-back')go({app:'photos'});
  else if(action==='photo-share')openModal({kind:'photo-share',member:d.member});
  else if(action==='photo-to-compose')showCompose(d.type,[photos.find(p=>p.member===d.member)]);
  else if(action==='photo-next'||action==='photo-prev')navigatePhoto(action==='photo-next'?1:-1);
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
  else if(action==='chat-heart'){
    if(route.app!=='kakao'||route.page!=='chat')return;
    sendChatMessage('kakao',route.member,C.kakaoEmoji.value);commit();
  }
  else if(action==='chat-share')openModal({kind:'pick-post'});
  else if(action==='toast-open'){
    if(!toastAction)return;const n=toastAction;$('#toast').innerHTML='';clearTimeout(toastTimer);toastAction=null;
    if(n.postId){previousRoute={app:'instagram',page:'feed'};go({app:'instagram',page:'post',postId:n.postId});if(['comment','comment-like'].includes(n.kind)){const comment=state.posts.find(p=>p.id===n.postId)?.comments.find(c=>c.id===n.commentId);openModal({kind:'comments',postId:n.postId,expandedThreads:comment?.parentId?[comment.parentId]:[]});}}else go({app:n.channel==='kakao'?'kakao':'instagram',page:'chat',member:n.member});
  } else if(action==='reset')openModal({kind:'reset'});
  else if(action==='confirm-reset')return restartGame(button);
});

function sendChatMessage(channel,id,text) {
  addMessage(state,channel,id,text,'me');
  queueKeywordReplies(state,C,channel,id,text);
  queueEmojiReplies(state,C,channel,id,text);
}
document.addEventListener('submit',event=>{
  const id=event.target.id;
  if(!['setup-form','chat-form','comment-form','profile-form'].includes(id))return;
  event.preventDefault();
  if(resetting)return;
  if(id==='setup-form') {
    try{completeOnboarding(state,$('#setup-username').value,$('#setup-nickname').value,Date.now(),C);commit(false);go({app:'lock'});}
    catch(error){$('#setup-error').textContent=error.message;}
    return;
  }
  if(!state.onboardingComplete)return;
  if(id==='chat-form') {
    const input=$('#chat-input'),text=input.value.trim();if(!text)return;
    const channel=route.app==='kakao'?'kakao':'instagram';sendChatMessage(channel,route.member,text);input.value='';drafts[`${route.app}:${route.member}`]='';commit();
  } else if(id==='comment-form') {
    const text=$('#comment-input').value.trim();if(!text)return;
    const comment=addComment(state,C,modal.postId,text,modal.replyTo||null);if(!comment)return;
    $('#comment-input').value='';modal.draft='';modal.replyTo=null;
    if(comment.parentId)modal.expandedThreads=[...new Set([...(modal.expandedThreads||[]),comment.parentId])];
    commit();renderModal();$('#comment-input')?.focus();
  } else if(id==='profile-form') {
    const name=$('#player-name').value.trim(),handle=$('#player-username').value.trim();if(!name||!handle)return;
    try{completeOnboarding(state,handle,$('#player-nickname').value,Date.now(),C);}catch(error){toast(error.message);return;}
    state.profile.name=name;state.profile.bio=$('#player-bio').value;commit();closeModal();toast('已儲存');
  }
});
document.addEventListener('input',event=>{
  const id=event.target.id;
  if(id==='chat-input'||id==='compose-caption')captureDraft();
  if(id==='photo-description'&&route.app==='photos'&&route.photo){state.photoDetails[route.photo].description=event.target.value;persist();}
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
function pressHome(){if(!state||!state.onboardingComplete)return;if(modal)closeModal(false);if(route.app==='lock')unlock();else go({app:'home'});}
$('#home-button').addEventListener('click',pressHome);
let homeGesture=null;
$('#home-button').addEventListener('pointerdown',event=>{homeGesture=event.clientY;event.currentTarget?.setPointerCapture?.(event.pointerId);});
$('#home-button').addEventListener('pointerup',event=>{if(homeGesture!==null&&homeGesture-event.clientY>15)pressHome();homeGesture=null;});
$('#home-button').addEventListener('pointercancel',()=>{homeGesture=null;});

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
  const mode=event.target.dataset.mode,activeModal=modal,uploadState=state;
  if(mode==='compose'&&activeModal?.kind!=='compose')return;
  inFlightUpload=true;if(mode==='compose'){captureDraft();renderModal();}
  try {
    const processed=[];
    for(const file of files.slice(0,1))processed.push({id:uid(),src:await readImage(file),filename:file.name});
    if(resetting||state!==uploadState)return;
    if(mode==='avatar'){state.profile.avatar=processed[0].src;commit();toast('已更換你的頭貼');}
    else if(modal===activeModal)activeModal.images=processed;
    if(files.length>1)toast('已選取第一張照片');
  } catch(error){if(state===uploadState&&!resetting)toast(error.message);}
  finally{if(state===uploadState){inFlightUpload=false;if(modal===activeModal)renderModal();}}
});
function processJobs(now=Date.now()) {
  if(!state||saveBroken||resetting||!state.onboardingComplete)return;
  const notices=runDueJobs(state,C,now);
  if(!notices.length)return;
  for(const n of notices)if(route.page==='chat'&&route.member===n.member&&((route.app==='kakao'&&n.channel==='kakao')||(route.app==='instagram'&&n.channel==='instagram')))markRead(n.channel,n.member);
  const updateComments=modal?.kind==='comments'&&notices.some(n=>['comment','comment-like'].includes(n.kind)&&n.postId===modal.postId);
  commit();
  if(updateComments)renderModal();
  const n=notices.filter(n=>n.text&&!n.quiet).at(-1);if(n)toast(n.text,n);
}
async function boot() {
  $('#signal').innerHTML=icon('signal');$('#wifi').innerHTML=icon('wifi');
  const loaded=await openStorage();
  try{state=loaded?validateSave(loaded,C):createState(C);}
  catch{state=createState(C);saveBroken=true;}
  advancePostLikes(state,C);scheduleRandomDialogue(state,C);
  route={app:state.onboardingComplete?'lock':'setup'};refresh();persist();
  if(saveBroken)toast('原存檔無法讀取，可在設定中重新開始。');
  weatherClient.refresh();
  clockTimer=setInterval(updateClock,1000);
  setInterval(()=>{if(document.visibilityState!=='hidden')weatherClient.refresh();},60000);
  setInterval(updatePostEngagement,C.memberAudience?.refreshMs||5000);
  setInterval(processJobs,400);
}
boot();
