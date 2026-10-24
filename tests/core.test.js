import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createState,publish,runDueJobs,queueKeywordReplies,addMessage,unreadCount,validateSave,createPhotoDetails,photoLibrary,completeOnboarding,personalize} from '../js/core.js';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../js/config.js',import.meta.url),'utf8'),context);
const config=context.window.PHONE_CONFIG;
const photo=id=>({id,src:config.assets.pairedPhoto(id,'me'),member:id,side:'me'});
const start=100000;

test('five photo branches follow the exact requested A → B mapping',()=>{
  const map={yeji:'ryujin',lia:'yuna',ryujin:'chaeryeong',chaeryeong:'lia',yuna:'yeji'};
  for(const [a,b] of Object.entries(map)){
    const s=createState(config,start);publish(s,config,{images:[photo(a)],caption:'我的照片'},start);
    assert.equal(runDueJobs(s,config,start+1199).length,0);
    let notices=runDueJobs(s,config,start+1200);assert.equal(notices[0].member,a);assert.equal(s.events[a].phase,'asked');assert.equal(s.posts.length,1);
    runDueJobs(s,config,start+4699);assert.equal(s.posts.length,1);
    notices=runDueJobs(s,config,start+4700);assert.equal(s.posts.length,2);assert.equal(s.posts[0].author,a);assert.equal(s.posts[0].images[0].src,`photo/ins/${a}/her.jpg`);assert.equal(s.events[a].phase,'posted');assert.ok(notices[0].postId);
    notices=runDueJobs(s,config,start+6900);assert.equal(notices[0].member,b);assert.equal(s.chats.instagram[b].at(-1).text,config.photoEvents.scripts[a].observer);assert.equal(s.events[a].phase,'done');assert.equal(s.jobs.length,0);
  }
});
test('multi-photo posts trigger each relevant member once; repeat shares do not replay',()=>{
  const s=createState(config,start);publish(s,config,{images:[photo('yeji'),photo('lia'),photo('yeji')]},start);assert.equal(s.jobs.length,2);
  publish(s,config,{images:[photo('yeji'),photo('lia')]},start+20);assert.equal(s.jobs.length,2);
  runDueJobs(s,config,start+1200);runDueJobs(s,config,start+4700);runDueJobs(s,config,start+6900);
  assert.equal(s.posts.filter(p=>p.author==='yeji').length,1);assert.equal(s.posts.filter(p=>p.author==='lia').length,1);
});
test('stories trigger photo branches and survive save/restore between stages',()=>{
  let s=createState(config,start);const story=publish(s,config,{type:'story',images:[photo('yuna')]},start);assert.equal(story.author,'me');assert.equal(s.posts.length,0);
  s=validateSave(JSON.parse(JSON.stringify(s)),config);runDueJobs(s,config,start+1200);
  s=validateSave(JSON.parse(JSON.stringify(s)),config);runDueJobs(s,config,start+4700);runDueJobs(s,config,start+6900);
  assert.equal(s.events.yuna.phase,'done');assert.equal(s.chats.instagram.yeji.length,1);
});
test('unrelated image uploads do not trigger a member',()=>{
  const s=createState(config,start);publish(s,config,{images:[{src:'data:image/jpeg;base64,YQ=='}]},start);assert.equal(s.jobs.length,0);
});
test('observer only asks when both the user and member have shared',()=>{
  const s=createState(config,start);const p=publish(s,config,{images:[photo('ryujin')]},start);runDueJobs(s,config,start+1200);runDueJobs(s,config,start+4700);s.posts=s.posts.filter(x=>x.id!==p.id);const notices=runDueJobs(s,config,start+6900);assert.equal(notices.length,0);assert.equal(s.chats.instagram.chaeryeong.length,0);
});
test('keyword rules are blank by default and do not invent replies',()=>{
  const s=createState(config,start);queueKeywordReplies(s,config,'kakao','yeji','晚餐一起吃飯',start);assert.equal(s.jobs.length,0);
});
test('configured keyword rule respects member, channel, delay and once',()=>{
  const c={...config,keywordRules:{kakao:[{id:'dinner',member:'yeji',keywords:['晚餐','Dinner'],replies:['想吃什麼？','一起去吧'],delay:1000,once:true}],instagram:[]}};
  const s=createState(c,start);queueKeywordReplies(s,c,'kakao','lia','Dinner',start);queueKeywordReplies(s,c,'instagram','yeji','Dinner',start);assert.equal(s.jobs.length,0);
  queueKeywordReplies(s,c,'kakao','yeji','dinner',start);queueKeywordReplies(s,c,'kakao','yeji','晚餐',start);assert.equal(s.jobs.length,2);
  assert.equal(runDueJobs(s,c,start+999).length,0);assert.equal(runDueJobs(s,c,start+1000)[0].text,'想吃什麼？');assert.equal(runDueJobs(s,c,start+2000)[0].text,'一起去吧');
});
test('scheduled incoming messages restore with the remaining queue',()=>{
  const c={...config,incomingMessages:[{id:'hi',member:'lia',channel:'kakao',text:'嗨',delay:1000}]};const s=createState(c,start);const restored=validateSave(JSON.parse(JSON.stringify(s)),c);assert.equal(runDueJobs(restored,c,start+1000)[0].text,'嗨');assert.equal(runDueJobs(restored,c,start+2000).length,0);
});
test('outgoing text and shared posts do not count as unread',()=>{
  const s=createState(config,start);const initial=unreadCount(s,'kakao','yeji');addMessage(s,'kakao','yeji','你好','me',start);assert.equal(unreadCount(s,'kakao','yeji'),initial);addMessage(s,'kakao','yeji','哈囉','yeji',start);assert.equal(unreadCount(s,'kakao','yeji'),initial+1);addMessage(s,'instagram','lia','傳送貼文','me',start,{kind:'post',postId:'x'});assert.equal(unreadCount(s,'instagram'),0);
});
test('invalid imports are rejected while valid saves preserve comments and pictures',()=>{
  assert.throws(()=>validateSave({},config));assert.throws(()=>publish(createState(config),config,{images:[]}));const s=createState(config,start);const p=publish(s,config,{images:[photo('lia')],caption:'hello'},start);p.comments.push({id:'test',author:'me',text:'好看',time:start});const restored=validateSave(JSON.parse(JSON.stringify(s)),config);assert.equal(restored.posts[0].comments[0].text,'好看');delete restored.chats.kakao.lia;assert.throws(()=>validateSave(restored,config));
});

test('each photo gets a unique date from 1–7 and the library is chronological',()=>{
  const state=createState(config,start);state.photoDetails=createPhotoDetails(config,()=>.4);
  const library=photoLibrary(state,config),days=Array.from(library,p=>p.daysAgo);
  assert.equal(days.length,5);assert.equal(new Set(days).size,5);assert.ok(days.every(n=>n>=1&&n<=7));assert.deepEqual(days,[...days].sort((a,b)=>a-b));
  state.photoDetails[library[0].id].description='照片說明';
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.deepEqual(photoLibrary(restored,config),photoLibrary(state,config));
});

test('onboarding validates identity, pauses incoming jobs and personalizes dialogue',()=>{
  const c={...config,incomingMessages:[{id:'hello',channel:'kakao',member:'yeji',text:'{{nickname}}，嗨',delay:1000}]};
  const state=createState(c,start);assert.equal(state.onboardingComplete,false);
  assert.throws(()=>completeOnboarding(state,'bad name','小雨',start+5000));assert.throws(()=>completeOnboarding(state,'rain.zip',' ',start+5000));assert.equal(state.onboardingComplete,false);
  completeOnboarding(state,' @rain.zip ',' 小雨 ',start+5000);assert.equal(state.profile.username,'rain.zip');assert.equal(state.profile.nickname,'小雨');assert.equal(state.jobs[0].dueAt,start+6000);
  const notice=runDueJobs(state,c,start+6000)[0];assert.equal(personalize(state,notice.text),'小雨，嗨');
});

test('legacy saves keep existing chats and posts while adding setup and photo details',()=>{
  const state=createState(config,start);publish(state,config,{images:[photo('lia')],caption:'舊貼文'},start);
  const originalMessage=state.chats.kakao.lia[0].text;delete state.photoDetails;delete state.onboardingComplete;delete state.profile.nickname;
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.equal(restored.onboardingComplete,false);assert.equal(restored.profile.nickname,state.profile.name);assert.equal(restored.posts[0].caption,'舊貼文');assert.equal(restored.chats.kakao.lia[0].text,originalMessage);assert.equal(Object.keys(restored.photoDetails).length,5);
});

test('invalid photo dates in imported saves are rejected',()=>{
  const state=createState(config,start);state.photoDetails.yeji.daysAgo=99;assert.throws(()=>validateSave(state,config),/照片資訊/);
});
