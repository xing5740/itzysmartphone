import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createState,publish,runDueJobs,queueKeywordReplies,queueEmojiReplies,addMessage,unreadCount,validateSave,createPhotoDetails,photoLibrary,completeOnboarding,personalize,startDialogue,dialogueChoices,chooseDialogue,addComment,toggleCommentLike,initializePostAudience,advancePostLikes,scheduleRandomDialogue} from '../js/core.js';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../js/config.js',import.meta.url),'utf8'),context);
const fullConfig=context.window.PHONE_CONFIG;
// Existing member/story tests isolate public member comments from the new fan-comment stream.
const config={...fullConfig,memberAudience:{...fullConfig.memberAudience,playerCommentCount:[0,0]}};
const branchConfig={...config,dialogues:Object.fromEntries(Object.entries(config.dialogues).map(([id,script])=>[id,{...script,start:"invite"}]))};
const photo=id=>({id,src:config.assets.pairedPhoto(id,'me'),member:id,side:'me'});
const start=100000;
const dmAt=start+config.photoEvents.dmDelay,postAt=dmAt+config.photoEvents.postDelay,followUpAt=postAt+config.photoEvents.followUpDelay;

test('all five photo branches publish posts and the pictured member follows up',()=>{
  for(const a of Array.from(config.members,m=>m.id)){
    const c={...config,postComments:null};
    const s=createState(c,start);publish(s,c,{images:[photo(a)],caption:'我的照片'},start);
    assert.equal(runDueJobs(s,c,dmAt-1).length,0);
    let notices=runDueJobs(s,c,dmAt);assert.equal(notices[0].member,a);assert.equal(s.events[a].phase,'asked');assert.equal(s.posts.length,1);
    runDueJobs(s,c,postAt-1);assert.equal(s.posts.length,1);
    notices=runDueJobs(s,c,postAt);assert.equal(s.posts.length,2);assert.equal(s.posts[0].author,a);assert.equal(s.posts[0].images[0].src,`photo/ins/${a}/her.jpg`);assert.equal(s.events[a].phase,'posted');assert.ok(notices[0].postId);
    notices=runDueJobs(s,c,followUpAt);assert.equal(notices[0].member,a);assert.equal(s.chats.instagram[a].at(-1).text,config.photoEvents.scripts[a].followUp);assert.equal(s.events[a].phase,'done');assert.equal(s.jobs.length,0);
  }
});
test('separate single-photo posts trigger each member once; repeat shares do not replay',()=>{
  const s=createState(config,start);publish(s,config,{images:[photo('yeji')]},start);publish(s,config,{images:[photo('lia')]},start);assert.equal(s.jobs.filter(j=>j.type==='photo-dm').length,2);
  publish(s,config,{images:[photo('yeji')]},start+20);publish(s,config,{images:[photo('lia')]},start+20);assert.equal(s.jobs.filter(j=>j.type==='photo-dm').length,2);
  runDueJobs(s,config,dmAt);runDueJobs(s,config,postAt);runDueJobs(s,config,followUpAt);
  assert.equal(s.posts.filter(p=>p.author==='yeji').length,1);assert.equal(s.posts.filter(p=>p.author==='lia').length,1);
});
test('stories trigger photo branches and survive save/restore between stages',()=>{
  let s=createState(config,start);const story=publish(s,config,{type:'story',images:[photo('yuna')]},start);assert.equal(story.author,'me');assert.equal(s.posts.length,0);
  s=validateSave(JSON.parse(JSON.stringify(s)),config);runDueJobs(s,config,dmAt);
  s=validateSave(JSON.parse(JSON.stringify(s)),config);runDueJobs(s,config,postAt);runDueJobs(s,config,followUpAt);
  assert.equal(s.events.yuna.phase,'done');assert.equal(s.chats.instagram.yuna.length,2);assert.equal(s.chats.instagram.yeji.length,0);
});
test('unrelated image uploads do not trigger a member',()=>{
  const s=createState(config,start);publish(s,config,{images:[{src:'data:image/jpeg;base64,YQ=='}]},start);assert.equal(s.jobs.length,0);
});
test('member follows up only when both player and counterpart posts still exist',()=>{
  const s=createState(config,start);const p=publish(s,config,{images:[photo('ryujin')]},start);runDueJobs(s,config,dmAt);runDueJobs(s,config,postAt);s.posts=s.posts.filter(x=>x.id!==p.id);runDueJobs(s,config,followUpAt);const notices=runDueJobs(s,config,s.jobs.find(j=>j.type==='photo-follow-up').dueAt);assert.equal(notices.length,0);assert.equal(s.chats.instagram.ryujin.length,1);assert.equal(s.events.ryujin.phase,'done');
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

test('configured photo descriptions seed new saves and fill legacy blanks only once',()=>{
  const state=createState(config,start);
  for(const m of config.members)assert.equal(state.photoDetails[m.id].description,config.photoDescriptions[m.id]);
  delete state.photoDescriptionVersion;
  state.photoDetails.yeji.description='';state.photoDetails.lia.description='我自己寫的說明';
  const originalDays=state.photoDetails.yeji.daysAgo;
  const upgraded=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.equal(upgraded.photoDetails.yeji.description,config.photoDescriptions.yeji);
  assert.equal(upgraded.photoDetails.lia.description,'我自己寫的說明');
  assert.equal(upgraded.photoDetails.yeji.daysAgo,originalDays);
  upgraded.photoDetails.yeji.description='';
  assert.equal(validateSave(JSON.parse(JSON.stringify(upgraded)),config).photoDetails.yeji.description,'');
});

test('each member has a valid branching script and choices reach the selected branch',()=>{
  for(const m of branchConfig.members){
    const state=createState(branchConfig,start);completeOnboarding(state,'rain.zip','小雨',start);
    assert.equal(startDialogue(state,branchConfig,'kakao',m.id,start),true);assert.equal(startDialogue(state,branchConfig,'kakao',m.id,start),false);
    assert.equal(dialogueChoices(state,branchConfig,'kakao',m.id).length,0);runDueJobs(state,branchConfig,start+600);
    const choices=dialogueChoices(state,branchConfig,'kakao',m.id);assert.ok(choices.length>=2);
    const selected=choices[1],node=state.dialogueSessions.kakao[m.id].nodeId;
    assert.equal(chooseDialogue(state,branchConfig,'kakao',m.id,node,selected.id,start+700),true);
    assert.equal(chooseDialogue(state,branchConfig,'kakao',m.id,node,selected.id,start+701),false);
    assert.equal(state.chats.kakao[m.id].at(-1).text,selected.text);runDueJobs(state,branchConfig,start+1600);
    assert.equal(state.dialogueSessions.kakao[m.id].nodeId,selected.next);
    assert.equal(state.chats.kakao[m.id].at(-1).text,branchConfig.dialogues[m.id].nodes[selected.next].message);
  }
});

test('pending dialogue replies restore once and channels have independent cursors',()=>{
  const enabled={...branchConfig,dialogueChannels:['kakao','instagram']};
  const state=createState(enabled,start);completeOnboarding(state,'rain.zip','小雨',start);
  startDialogue(state,enabled,'kakao','yeji',start);startDialogue(state,enabled,'instagram','yeji',start);runDueJobs(state,enabled,start+600);
  chooseDialogue(state,enabled,'kakao','yeji','invite','coffee',start+700);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),enabled);runDueJobs(restored,enabled,start+1600);
  const count=restored.chats.kakao.yeji.length;runDueJobs(restored,enabled,start+5000);assert.equal(restored.chats.kakao.yeji.length,count);
  assert.equal(restored.dialogueSessions.kakao.yeji.nodeId,'coffee');assert.equal(restored.dialogueSessions.instagram.yeji.nodeId,'invite');
  assert.equal(chooseDialogue(restored,enabled,'kakao','yeji','invite','later',start+1700),false);
  assert.equal(dialogueChoices(restored,enabled,'instagram','yeji').length,2);
});

test('legacy saves gain dialogue sessions without resetting existing messages',()=>{
  const state=createState(config,start);const count=state.chats.kakao.yeji.length;delete state.dialogueSessions;
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);assert.equal(restored.chats.kakao.yeji.length,count);assert.ok(restored.dialogueSessions.kakao);
});

test('each member has three emoji response variants that restore in order',()=>{
  assert.deepEqual(Object.keys(config.kakaoEmoji.replies).sort(),Array.from(config.members,m=>m.id).sort());
  for(const m of config.members){
    assert.equal(config.kakaoEmoji.replies[m.id].length,3);
    for(const [index,rng] of [0,.5,.99].entries()){
      let state=createState(config,start);state.profile.nickname='小雨';
      assert.equal(queueEmojiReplies(state,config,'kakao',m.id,'❤️',start,()=>rng),true);
      assert.equal(runDueJobs(state,config,start+899).length,0);
      const first=runDueJobs(state,config,start+900)[0];assert.equal(first.text,config.kakaoEmoji.replies[m.id][index][0]);assert.equal(first.member,m.id);
      state=validateSave(JSON.parse(JSON.stringify(state)),config);
      const second=runDueJobs(state,config,start+1800)[0];assert.equal(second.text,config.kakaoEmoji.replies[m.id][index][1]);assert.equal(second.member,m.id);
      assert.equal(state.chats.kakao[m.id].at(-1).sender,m.id);
      assert.equal(runDueJobs(state,config,start+2500).length,0);
    }
  }
});

test('emoji replies stay in the selected KKT chat and do not advance choice branches',()=>{
  const state=createState(config,start);completeOnboarding(state,'rain.zip','小雨',start);
  for(const m of config.members)assert.equal(queueEmojiReplies(state,config,'instagram',m.id,'❤️',start),false);
  assert.equal(queueEmojiReplies(state,config,'instagram','yeji','❤️',start),false);assert.equal(queueEmojiReplies(state,config,'kakao','yeji','今天見',start),false);assert.equal(state.jobs.length,0);
  const others=Object.fromEntries(config.members.filter(m=>m.id!=='yeji').map(m=>[m.id,state.chats.kakao[m.id].length]));
  startDialogue(state,config,'kakao','yeji',start);runDueJobs(state,config,start+600);queueEmojiReplies(state,config,'kakao','yeji','❤️',start+700,()=>0);runDueJobs(state,config,start+2500);
  assert.equal(state.dialogueSessions.kakao.yeji.nodeId,'welcome');assert.equal(dialogueChoices(state,config,'kakao','yeji').length,1);
  for(const [id,count] of Object.entries(others))assert.equal(state.chats.kakao[id].length,count);
});

test('Instagram choice dialogue is disabled including pending jobs from older saves',()=>{
  const state=createState(config,start);completeOnboarding(state,'rain.zip','小雨',start);
  assert.equal(startDialogue(state,config,'instagram','yeji',start),false);
  startDialogue(state,{...branchConfig,dialogueChannels:['instagram']},'instagram','yeji',start);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config),before=restored.chats.instagram.yeji.length;
  runDueJobs(restored,config,start+600);assert.equal(restored.chats.instagram.yeji.length,before);assert.equal(dialogueChoices(restored,config,'instagram','yeji').length,0);
});

test('each pictured member comments on every new post, including repeat shares',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:0}};
  for(const m of config.members){
    const state=createState(c,start);
    const first=publish(state,c,{images:[photo(m.id)],caption:'一張喜歡的照片'},start,()=>.99),second=publish(state,c,{images:[photo(m.id)],caption:'一張喜歡的照片'},start,()=>.99);
    assert.equal(state.jobs.filter(j=>j.type==='photo-dm').length,1);
    assert.equal(state.jobs.filter(j=>j.type==='post-comment').length,2);
    deliverPhotoPosts(state,c);runDueJobs(state,c,postAt+c.postComments.memberDelay);
    for(const post of [first,second]){assert.equal(post.comments.length,1);assert.equal(post.comments[0].author,m.id);assert.ok(c.postComments.memberReplies[m.id].some(t=>personalize(state,t)===post.comments[0].text));}
    deliverPhotoPosts(state,c);runDueJobs(state,c,postAt+c.postComments.memberDelay);assert.equal(first.comments.length,1);
  }
});

test('single-photo posts have one owner comment and positive random other comments',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:1,maxOthers:2}};
  const state=createState(c,start);
  const post=publish(state,c,{images:[photo('yeji')],caption:'喜歡這張'},start,()=>0);
  const comments=state.jobs.filter(j=>j.type==='post-comment');assert.equal(comments.length,3);assert.equal(new Set(comments.map(j=>j.member)).size,3);
  deliverPhotoPosts(state,c);runDueJobs(state,c,Math.max(...comments.map(j=>j.dueAt)));
  assert.equal(post.comments.filter(c=>c.author==='yeji').length,1);
  for(const comment of post.comments.filter(c=>c.author!=='yeji'))assert.ok(config.postComments.otherReplies[comment.author].includes(comment.text));
});

test('pending random comments survive reload and cannot be delivered twice',()=>{
  const state=createState(config,start),post=publish(state,config,{images:[photo('yuna')]},start,()=>0);
  const planned=state.jobs.filter(j=>j.type==='post-comment').map(j=>({...j}));
  state.jobs.push({...planned[0]});
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  deliverPhotoPosts(restored,config);runDueJobs(restored,config,Math.max(...restored.jobs.filter(j=>j.type==='post-comment').map(j=>j.dueAt)));
  const savedPost=restored.posts.find(p=>p.id===post.id);assert.equal(savedPost.comments.length,planned.length);
  for(const job of planned){const comment=savedPost.comments.find(c=>c.id===job.id);assert.equal(comment.author,job.member);assert.equal(comment.text,personalize(restored,job.text));}
});

test('stories and unrelated uploads do not queue public photo comments',()=>{
  const state=createState(config,start);
  publish(state,config,{type:'story',images:[photo('yeji')]},start);
  publish(state,config,{images:[{src:'data:image/jpeg;base64,YQ=='}]},start);
  assert.equal(state.jobs.filter(j=>j.type==='post-comment').length,0);
});

test('comments follow explicit selfie, meal, shopping and outing descriptions',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:1}};
  for(const [id,caption,context] of [
    ['yeji','Yeji 傳來的自拍照','sentSelfie'],['yuna','Yuna 傳來的自拍照','sentSelfie'],
    ['lia','和 Lia 一起去吃飯的時候拍的','meal'],['ryujin','和 Ryujin 一起去逛街的時候拍的','shopping'],
    ['chaeryeong','和 Chaeryeong 一起出去玩的時候拍的','outing']
  ]){
    const state=createState(c,start);const post=publish(state,c,{images:[photo(id)],caption},start,()=>0);
    const rule=c.postComments.contexts.find(r=>r.id===context),jobs=state.jobs.filter(j=>j.type==='post-comment');
    assert.ok(rule.memberReplies.includes(jobs.find(j=>j.member===id).text));
    for(const job of jobs.filter(j=>j.member!==id))assert.ok(rule.otherReplies.includes(job.text));
    deliverPhotoPosts(state,c);runDueJobs(state,c,Math.max(...jobs.map(j=>j.dueAt)));assert.ok(post.comments.some(x=>x.author===id));
    if(context==='sentSelfie')assert.ok(post.comments.every(x=>!x.text.includes('被你拍')&&!x.text.includes('攝影師')));
  }
});

test('edited post captions override saved photo descriptions',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:0}};
  const state=createState(c,start),image={...photo('yeji'),description:'Yeji 傳來的自拍照'};
  publish(state,c,{images:[image],caption:'和 Yeji 一起吃晚餐'},start,()=>0);
  const job=state.jobs.find(j=>j.type==='post-comment');
  assert.ok(c.postComments.contexts.find(r=>r.id==='meal').memberReplies.includes(job.text));
});

test('single-photo comments use the selected member and caption context',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:1}},state=createState(c,start);
  publish(state,c,{images:[photo('yeji')],caption:'Yeji 傳來的自拍照'},start,()=>0);
  const jobs=state.jobs.filter(j=>j.type==='post-comment'),context=c.postComments.contexts.find(r=>r.id==='sentSelfie');
  assert.ok(context.memberReplies.includes(jobs.find(j=>j.member==='yeji').text));
  for(const job of jobs.filter(j=>j.member!=='yeji'))assert.ok(context.otherReplies.includes(job.text));
});

test('unrecognized or deliberately cleared descriptions use neutral compliments',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:1}};
  for(const caption of ['今天心情很好','']){
    const state=createState(c,start);state.photoDetails.yeji.description='';
    publish(state,c,{images:[{...photo('yeji'),description:''}],caption},start,()=>0);
    for(const job of state.jobs.filter(j=>j.type==='post-comment')){
      const options=job.member==='yeji'?c.postComments.memberReplies.yeji:c.postComments.otherReplies[job.member];
      assert.ok(options.includes(job.text));
    }
  }
});

test('negated selfie descriptions can select a photographer response',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:0}};
  const state=createState(c,start);publish(state,c,{images:[photo('yeji')],caption:'不是 自拍，是我幫 Yeji 拍的'},start,()=>0);
  assert.ok(c.postComments.contexts.find(r=>r.id==='portrait').memberReplies.includes(state.jobs.find(j=>j.type==='post-comment').text));
});

function commentFixture(author='yeji') {
  const state=createState(config,start),post=publish(state,config,{images:[{src:'data:image/jpeg;base64,YQ=='}]},start);
  post.comments.push({id:'original-comment',author,text:'這張好好看',time:start});
  return {state,post,root:post.comments[0]};
}

test('each replied-to member likes the player reply after the configured delay',()=>{
  for(const m of config.members){
    const {state,post,root}=commentFixture(m.id),reply=addComment(state,config,post.id,'謝謝你 ❤️',root.id,start);
    assert.equal(reply.parentId,root.id);assert.equal(reply.replyTo,root.id);assert.equal(reply.likedBy.length,0);
    assert.equal(runDueJobs(state,config,start+config.postComments.replyLikeDelay-1).length,0);
    const notice=runDueJobs(state,config,start+config.postComments.replyLikeDelay)[0];
    assert.equal(notice.kind,'comment-like');assert.equal(notice.member,m.id);assert.deepEqual(reply.likedBy,[m.id]);assert.equal(notice.commentId,reply.id);
  }
});

test('comment likes toggle independently and member likes survive reload without duplicates',()=>{
  let {state,post,root}=commentFixture();
  assert.equal(toggleCommentLike(state,post.id,root.id),true);assert.deepEqual(root.likedBy,['me']);
  toggleCommentLike(state,post.id,root.id);assert.deepEqual(root.likedBy,[]);
  const reply=addComment(state,config,post.id,'我也喜歡',root.id,start);state.jobs.push({...state.jobs[0]});
  state=validateSave(JSON.parse(JSON.stringify(state)),config);runDueJobs(state,config,start+config.postComments.replyLikeDelay);
  const saved=state.posts.find(p=>p.id===post.id).comments.find(c=>c.id===reply.id);assert.deepEqual(saved.likedBy,['yeji']);
  toggleCommentLike(state,post.id,reply.id);assert.deepEqual(saved.likedBy,['yeji','me']);toggleCommentLike(state,post.id,reply.id);assert.deepEqual(saved.likedBy,['yeji']);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);runDueJobs(restored,config,start+9999);assert.deepEqual(restored.posts[0].comments.find(c=>c.id===reply.id).likedBy,['yeji']);
});

test('nested replies target the actual author and remain in the original thread',()=>{
  const {state,post,root}=commentFixture();post.comments.push({id:'lia-reply',author:'lia',text:'我也喜歡',time:start,parentId:root.id,replyTo:root.id,likedBy:[]});
  const reply=addComment(state,config,post.id,'謝謝 Lia', 'lia-reply',start);assert.equal(reply.parentId,root.id);assert.equal(reply.replyTo,'lia-reply');
  runDueJobs(state,config,start+config.postComments.replyLikeDelay);assert.deepEqual(reply.likedBy,['lia']);
  const own=addComment(state,config,post.id,'自己補充一下',reply.id,start);assert.equal(own.parentId,root.id);assert.equal(state.jobs.length,0);
});

test('ordinary comments have no automatic member likes and invalid targets do not post',()=>{
  const {state,post}=commentFixture(),ordinary=addComment(state,config,post.id,'普通留言',null,start);
  assert.equal(ordinary.parentId,null);assert.equal(state.jobs.length,0);
  const count=post.comments.length;assert.equal(addComment(state,config,post.id,' ',null,start),null);assert.equal(addComment(state,config,post.id,'回覆','missing',start),null);assert.equal(post.comments.length,count);assert.equal(toggleCommentLike(state,post.id,'missing'),false);
});

test('legacy comments gain empty likes without losing text; invalid reply graphs are rejected',()=>{
  const {state,post,root}=commentFixture();const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.equal(restored.posts[0].comments[0].text,root.text);assert.deepEqual(restored.posts[0].comments[0].likedBy,[]);assert.equal(restored.posts[0].comments[0].parentId,null);
  post.comments.push({id:'broken',author:'me',text:'回覆',time:start,parentId:'missing',replyTo:root.id,likedBy:[]});assert.throws(()=>validateSave(state,config),/討論串/);
});

function memberPost(state,id='yeji',now=start,random=Math.random) {
  const post={id:`post-${id}`,author:id,images:[{src:config.assets.pairedPhoto(id,'her'),member:id,side:'her'}],caption:'今天的照片',time:now,likes:0,liked:false,comments:[],slide:0};
  state.posts.push(post);initializePostAudience(state,config,post,now,random);return post;
}

test('all member posts have about 100 unique positive fan comments and stable identities on reload',()=>{
  const state=createState(config,start);
  for(const m of config.members){
    const post=memberPost(state,m.id);
    assert.ok(post.comments.length>=95&&post.comments.length<=105);
    assert.equal(new Set(post.comments.map(c=>c.author)).size,post.comments.length);
    assert.equal(new Set(post.comments.map(c=>c.text)).size,post.comments.length);
    const praise=new Set(config.memberAudience.compliments.flatMap(text=>config.memberAudience.emojis.map(emoji=>text.replaceAll('{{member}}',m.name)+emoji)));
    assert.ok(post.comments.every(c=>state.fans[c.author]&&praise.has(c.text)));
  }
  const original=JSON.stringify(state),restored=validateSave(JSON.parse(original),config);
  assert.equal(JSON.stringify(restored),original);
  const own=publish(restored,config,{images:[{src:'assets/moment-yeji.svg'}]},start);
  assert.equal(own.comments.length,0);
});

test('existing member posts gain fans once without losing player comments or likes',()=>{
  const state=createState(config,start),post=memberPost(state);post.comments=[{id:'old-comment',author:'me',text:'留著這則',time:start}];
  delete post.fanCommentsSeeded;delete post.engagement;delete state.fans;post.likes=12345;post.liked=true;
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config),updated=restored.posts[0];
  assert.equal(updated.likes,12345);assert.equal(updated.comments[0].text,'留著這則');assert.ok(updated.comments.length>=96);
  assert.equal(validateSave(JSON.parse(JSON.stringify(restored)),config).posts[0].comments.length,updated.comments.length);
});

test('replying to a fan preserves pending likes and liker identity through reload',()=>{
  const state=createState(config,start),post=memberPost(state),root=post.comments[0];
  toggleCommentLike(state,post.id,root.id);
  const reply=addComment(state,config,post.id,'謝謝你的誇獎',root.id,start),job=state.jobs.at(-1);
  assert.equal(job.dueAt,start+10000);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.equal(runDueJobs(restored,config,job.dueAt-1).length,0);
  assert.equal(runDueJobs(restored,config,job.dueAt)[0].member,root.author);
  const saved=restored.posts[0].comments.find(c=>c.id===reply.id);
  assert.deepEqual(saved.likedBy,[root.author]);assert.equal(runDueJobs(restored,config,job.dueAt+1).length,0);
  validateSave(JSON.parse(JSON.stringify(restored)),config);
});

test('post likes grow over time, catch up after reload and preserve manual likes',()=>{
  let state=createState(config,start);const post=memberPost(state),initial=post.likes,rate=post.engagement.likesPerMinute;
  assert.equal(advancePostLikes(state,config,start),false);
  assert.equal(advancePostLikes(state,config,start+60000),true);assert.equal(post.likes,initial+rate);
  assert.equal(advancePostLikes(state,config,start+60000),false);
  post.liked=true;post.likes++;
  state=validateSave(JSON.parse(JSON.stringify(state)),config);advancePostLikes(state,config,start+600000);
  const saved=state.posts[0];assert.equal(saved.likes,initial+rate*10+1);
  saved.liked=false;saved.likes--;assert.equal(saved.likes,initial+rate*10);
  assert.equal(advancePostLikes(state,config,start-1000),false);assert.equal(saved.likes,initial+rate*10);
});

test('player fan likes are gradual, capped and independent of the player heart',()=>{
  const state=createState(config,start),post=publish(state,config,{images:[{src:'assets/moment-yeji.svg'}]},start),rate=post.engagement.likesPerMinute;
  advancePostLikes(state,config,start+1000);assert.equal(post.likes,0);
  advancePostLikes(state,config,start+60000);assert.equal(post.likes,rate);assert.equal(post.fanLikes.length,rate);
  assert.ok(post.fanLikes.every(id=>state.fans[id]));
  post.liked=true;post.likes++;advancePostLikes(state,config,start+86400000);assert.equal(post.likes,config.memberAudience.playerMaxLikes+1);
  post.liked=false;post.likes--;advancePostLikes(state,config,start+172800000);assert.equal(post.likes,config.memberAudience.playerMaxLikes);
  assert.equal(new Set(post.fanLikes).size,post.fanLikes.length);
});

test('photo sequence strictly orders DM, post, owner comment, other comments and owner follow-up',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:1,maxOthers:2}};
  for(const member of c.members){
    let state=createState(c,start);const playerPost=publish(state,c,{images:[photo(member.id)],caption:'出去玩'},start);
    assert.equal(state.stories.length,0);
    runDueJobs(state,c,dmAt-1);assert.equal(state.chats.instagram[member.id].length,0);assert.equal(playerPost.comments.length,0);
    runDueJobs(state,c,dmAt);assert.equal(state.chats.instagram[member.id].length,1);
    assert.equal(state.jobs.find(j=>j.type==='photo-post').dueAt,dmAt+30000);
    runDueJobs(state,c,postAt-1);assert.equal(state.posts.length,1);assert.equal(playerPost.comments.length,0);
    state=validateSave(JSON.parse(JSON.stringify(state)),c);
    runDueJobs(state,c,postAt);assert.equal(state.posts[0].author,member.id);assert.equal(state.stories.length,0);
    const own=state.posts.find(p=>p.id===playerPost.id),ownerJob=state.jobs.find(j=>j.type==='post-comment'&&j.member===member.id);
    assert.equal(ownerJob.dueAt,postAt+15000);
    runDueJobs(state,c,ownerJob.dueAt-1);assert.equal(own.comments.length,0);
    const notices=runDueJobs(state,c,ownerJob.dueAt);assert.equal(notices[0].member,member.id);assert.equal(own.comments.length,1);
    assert.equal(state.chats.instagram[member.id].length,1);
    const otherJobs=state.jobs.filter(j=>j.type==='post-comment');assert.equal(otherJobs.length,2);
    assert.ok(otherJobs.every(j=>j.dueAt>ownerJob.dueAt));
    for(const job of otherJobs)runDueJobs(state,c,job.dueAt);
    assert.equal(own.comments.length,3);
    const followUp=state.jobs.find(j=>j.type==='photo-follow-up');assert.ok(followUp.dueAt>Math.max(...otherJobs.map(j=>j.dueAt)));
    state=validateSave(JSON.parse(JSON.stringify(state)),c);runDueJobs(state,c,followUp.dueAt-1);assert.equal(state.chats.instagram[member.id].length,1);
    runDueJobs(state,c,followUp.dueAt);assert.equal(state.chats.instagram[member.id].length,2);assert.equal(state.chats.instagram[member.id].at(-1).text,c.photoEvents.scripts[member.id].followUp);
    for(const other of c.members.filter(m=>m.id!==member.id))assert.equal(state.chats.instagram[other.id].length,0);assert.equal(state.events[member.id].phase,'done');
  }
});

function deliverPhotoPosts(state,c=config) {
  runDueJobs(state,c,dmAt);runDueJobs(state,c,postAt);
}

test('delayed tab processing preserves the 30-second post and 15-second comment intervals',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:1}};
  const state=createState(c,start),post=publish(state,c,{images:[photo('yeji')]},start);
  const lateDm=dmAt+3600000;runDueJobs(state,config,lateDm);
  assert.equal(state.posts.length,1);assert.equal(post.comments.length,0);
  const memberPostJob=state.jobs.find(j=>j.type==='photo-post');assert.equal(memberPostJob.dueAt,lateDm+30000);
  const latePost=memberPostJob.dueAt+3600000;runDueJobs(state,config,latePost);
  assert.equal(state.posts.length,2);assert.equal(post.comments.length,0);
  const ownComment=state.jobs.find(j=>j.type==='post-comment'&&j.member==='yeji');assert.equal(ownComment.dueAt,latePost+15000);
  runDueJobs(state,config,ownComment.dueAt-1);assert.equal(post.comments.length,0);
  runDueJobs(state,config,ownComment.dueAt);assert.equal(post.comments[0].author,'yeji');assert.equal(state.stories.length,0);
  const final=state.jobs.find(j=>j.type==='photo-follow-up'),lateComments=final.dueAt+3600000;
  runDueJobs(state,config,lateComments);assert.equal(state.chats.instagram.yeji.length,1);assert.equal(final.dueAt,lateComments+30000);
  runDueJobs(state,config,final.dueAt);assert.equal(state.chats.instagram.yeji.length,2);
});

test('new posts reject multiple images without changing progress; legacy posts still load',()=>{
  const state=createState(config,start);
  assert.throws(()=>publish(state,config,{images:[photo('yeji'),photo('lia')]},start),/只能上傳一張/);
  assert.equal(state.posts.length,0);assert.equal(state.jobs.length,0);assert.equal(Object.keys(state.events).length,0);
  const post=publish(state,config,{images:[photo('yeji')]},start);post.images.push(photo('lia'));
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);assert.equal(restored.posts[0].images.length,2);
});

test('legacy demo stories are removed while player stories and ongoing plot survive migration',()=>{
  const state=createState({...config,seedStories:true},start);
  const story=publish(state,config,{type:'story',images:[{src:'assets/moment-yeji.svg'}]},start);
  const post=publish(state,config,{images:[photo('yeji')]},start);
  runDueJobs(state,config,dmAt);
  delete state.photoSequenceVersion;
  const oldPostJob=state.jobs.find(j=>j.type==='photo-post');oldPostJob.dueAt=dmAt+3500;
  for(const job of state.jobs.filter(j=>j.type==='post-comment')){delete job.afterPosts;delete job.delayAfterPosts;job.dueAt=start+1800;}
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.equal(restored.stories.length,1);assert.equal(restored.stories[0].id,story.id);
  assert.equal(restored.jobs.find(j=>j.type==='photo-post').dueAt,postAt);
  runDueJobs(restored,config,postAt-1);assert.equal(restored.posts.length,1);assert.equal(restored.posts[0].comments.length,0);
  runDueJobs(restored,config,postAt);assert.equal(restored.posts.length,2);
  runDueJobs(restored,config,postAt+14999);assert.equal(restored.posts.find(p=>p.id===post.id).comments.length,0);
  runDueJobs(restored,config,postAt+15000);assert.equal(restored.posts.find(p=>p.id===post.id).comments[0].author,'yeji');
  assert.equal(restored.photoSequenceVersion,2);
});

test('each welcome dialogue waits for the player choice, then a final member response before completing',()=>{
  for(const member of config.members){
    let state=createState(config,start);completeOnboarding(state,'rain.zip','小雨',start,config);
    const opening=Array.from(state.chats.kakao[member.id],m=>m.text);
    startDialogue(state,config,'kakao',member.id,start);
    assert.equal(state.jobs.filter(j=>j.type==='welcome-reply').length,0);
    assert.deepEqual(Array.from(state.chats.kakao[member.id],m=>m.text),opening);
    assert.equal(dialogueChoices(state,config,'kakao',member.id).length,1);
    assert.equal(chooseDialogue(state,config,'kakao',member.id,'welcome','reply',start+1),true);
    assert.equal(chooseDialogue(state,config,'kakao',member.id,'welcome','reply',start+2),false);
    assert.equal(state.welcomeDone[member.id],undefined);assert.equal(state.randomDialogue.nextAt,null);
    assert.equal(state.chats.kakao[member.id].length,opening.length+1);
    const reply=state.jobs.find(j=>j.type==='welcome-reply');
    state=validateSave(JSON.parse(JSON.stringify(state)),config);
    runDueJobs(state,config,reply.dueAt-1);assert.equal(state.welcomeDone[member.id],undefined);
    runDueJobs(state,config,reply.dueAt);assert.equal(state.chats.kakao[member.id].length,opening.length+2);
    assert.equal(state.chats.kakao[member.id].at(-1).text,config.dialogues[member.id].nodes.welcome.response);
    assert.equal(state.welcomeDone[member.id],true);assert.equal(state.welcomePending[member.id],undefined);
    assert.ok(state.randomDialogue.nextAt>=reply.dueAt+45000);
    assert.equal(dialogueChoices(state,config,'kakao',member.id).length,0);
    assert.equal(startDialogue(state,config,'kakao',member.id,reply.dueAt+1),false);
    runDueJobs(state,config,reply.dueAt+1);assert.equal(state.chats.kakao[member.id].length,opening.length+2);
  }
});

function fanRandom(seed) {return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}

test('fan IDs form a larger, varied and unique pool without fixed numbering',()=>{
  const state=createState(config,start);memberPost(state,'yeji',start,fanRandom(42));
  const handles=Object.values(state.fans).map(f=>f.username);
  assert.equal(handles.length,1200);assert.equal(new Set(handles).size,1200);
  assert.ok(handles.every(id=>id.length>=5&&id.length<=30&&/^[a-z0-9_][a-z0-9_.]*[a-z0-9_]$/.test(id)&&!id.includes('..')));
  assert.ok(handles.every(id=>!/^\w+\.midzy_\d+_\d{3}$/.test(id)));
  assert.ok(handles.filter(id=>!/[0-9]/.test(id)).length>600);
  assert.ok(handles.filter(id=>id.includes('.')).length>300);assert.ok(handles.filter(id=>id.includes('_')).length>200);
  assert.ok(new Set(handles.map(id=>id.length)).size>12);
  assert.ok(Object.values(state.fans).every(f=>!Object.hasOwn(f,'name')));
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.deepEqual(Object.values(restored.fans).map(f=>f.username),handles);
  const other=createState(config,start);memberPost(other,'yeji',start,fanRandom(9876));
  const second=new Set(Object.values(other.fans).map(f=>f.username));assert.ok(handles.filter(id=>second.has(id)).length<200);
});

test('repeated random output still generates distinct handles without a numeric sequence',()=>{
  const state=createState(config,start);
  const c={...config,memberAudience:{...config.memberAudience,fanPoolSize:120,usernameNumberChance:0}};
  const post={id:'constant-rng',author:'yeji',images:[photo('yeji')],caption:'',time:start,likes:0,comments:[],liked:false};
  state.posts.push(post);initializePostAudience(state,c,post,start,()=>0);
  const handles=Object.values(state.fans).map(f=>f.username);
  assert.equal(handles.length,120);assert.equal(new Set(handles).size,120);assert.ok(handles.every(id=>!/[0-9]/.test(id)));
});

test('legacy fan IDs update once without losing comment or pending-like relationships',()=>{
  const state=createState(config,start);
  state.fans={'fan-1':{id:'fan-1',username:'peach.midzy_1_123',name:'小桃',color:'#e8cdd4'}};
  const post={id:'legacy-fan-post',author:'yeji',images:[photo('yeji')],caption:'照片',time:start,likes:50,liked:false,fanCommentsSeeded:true,comments:[{id:'fan-comment',author:'fan-1',text:'好漂亮',time:start,parentId:null,replyTo:null,likedBy:['me']}]};
  state.posts.push(post);const reply=addComment(state,config,post.id,'謝謝你','fan-comment',start);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config),fan=restored.fans['fan-1'];
  assert.equal(Object.keys(restored.fans).length,1200);assert.notEqual(fan.username,'peach.midzy_1_123');assert.equal(fan.name,undefined);
  assert.equal(restored.posts[0].comments[0].author,'fan-1');assert.deepEqual(restored.posts[0].comments[0].likedBy,['me']);
  assert.equal(restored.jobs[0].member,'fan-1');runDueJobs(restored,config,start+config.postComments.replyLikeDelay);
  assert.deepEqual(restored.posts[0].comments.find(c=>c.id===reply.id).likedBy,['fan-1']);
  const again=validateSave(JSON.parse(JSON.stringify(restored)),config);assert.equal(again.fans['fan-1'].username,fan.username);assert.equal(again.posts[0].comments.length,2);
});

test('old cross-member inquiry jobs are removed on restore while public comments still arrive',()=>{
  for(const version of [undefined,1]){
    const c={...config,postComments:{...config.postComments,otherChance:1}},state=createState(c,start);
    const post=publish(state,c,{images:[photo('yeji')]},start);deliverPhotoPosts(state,c);
    state.photoSequenceVersion=version;
    state.jobs=state.jobs.filter(j=>j.type!=='photo-follow-up');
    state.jobs.push({id:'old-cross-member-question',type:'photo-observer',member:'yeji',dueAt:postAt+1});
    const restored=validateSave(JSON.parse(JSON.stringify(state)),c);
    assert.ok(!restored.jobs.some(j=>j.type==='photo-observer'||j.type==='photo-follow-up'));
    const comments=restored.jobs.filter(j=>j.type==='post-comment');assert.equal(comments.length,3);
    runDueJobs(restored,c,Math.max(...comments.map(j=>j.dueAt))+c.photoEvents.followUpDelay+1);
    const saved=restored.posts.find(p=>p.id===post.id);assert.equal(saved.comments.length,3);assert.ok(saved.comments.some(c=>c.author==='yeji'));
    assert.equal(restored.chats.instagram.yeji.length,1);for(const other of c.members.filter(m=>m.id!=='yeji'))assert.equal(restored.chats.instagram[other.id].length,0);
    assert.equal(restored.events.yeji.phase,'done');assert.equal(restored.jobs.length,0);
  }
});

test('current owner follow-up jobs with the former name migrate without replaying comments',()=>{
  const c={...config,postComments:{...config.postComments,otherChance:1}},state=createState(c,start);
  const post=publish(state,c,{images:[photo('lia')]},start);deliverPhotoPosts(state,c);
  for(const job of state.jobs.filter(j=>j.type==='post-comment').sort((a,b)=>a.dueAt-b.dueAt))runDueJobs(state,c,job.dueAt);
  const followUp=state.jobs.find(j=>j.type==='photo-follow-up');followUp.type='photo-observer';
  const restored=validateSave(JSON.parse(JSON.stringify(state)),c),migrated=restored.jobs.find(j=>j.type==='photo-follow-up');
  assert.equal(migrated.dueAt,followUp.dueAt);assert.ok(!restored.jobs.some(j=>j.type==='photo-observer'));
  runDueJobs(restored,c,migrated.dueAt);
  assert.equal(restored.chats.instagram.lia.at(-1).text,c.photoEvents.scripts.lia.followUp);
  assert.equal(restored.posts.find(p=>p.id===post.id).comments.length,3);
  for(const other of c.members.filter(m=>m.id!=='lia'))assert.equal(restored.chats.instagram[other.id].length,0);
});

test('A unlocks after her final welcome reply; completing B during A never starts B early',()=>{
  const now=Date.now(),state=createState(config,now);completeOnboarding(state,'midzy.test','小雨',now,config);
  startDialogue(state,config,'kakao','yeji',now);chooseDialogue(state,config,'kakao','yeji','welcome','reply',now+1);
  assert.equal(state.randomDialogue.nextAt,null);
  const welcome=state.jobs.find(j=>j.type==='welcome-reply');runDueJobs(state,config,welcome.dueAt);
  const due=state.randomDialogue.nextAt;assert.ok(due>=welcome.dueAt+45000&&due<=welcome.dueAt+120000);
  assert.equal(state.welcomeDone.lia,undefined);
  runDueJobs(state,config,due);assert.equal(state.randomDialogue.activeMember,'yeji');assert.equal(state.dialogueSessions.kakao.yeji.nodeId,'invite');
  startDialogue(state,config,'kakao','lia',due+1);chooseDialogue(state,config,'kakao','lia','welcome','reply',due+2);
  const bWelcome=state.jobs.find(j=>j.type==='welcome-reply');runDueJobs(state,config,bWelcome.dueAt);
  assert.equal(state.welcomeDone.lia,true);assert.equal(state.randomDialogue.activeMember,'yeji');assert.equal(state.randomDialogue.nextAt,null);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  runDueJobs(restored,config,due+999999);assert.equal(restored.randomDialogue.activeMember,'yeji');assert.equal(restored.chats.kakao.lia.length,3);
  assert.equal(chooseDialogue(restored,config,'kakao','yeji','invite','later',due+1000000),true);
  const ending=restored.jobs.find(j=>j.type==='dialogue');assert.equal(restored.randomDialogue.activeMember,'yeji');
  runDueJobs(restored,config,ending.dueAt);assert.equal(restored.randomDialogue.activeMember,null);
  const nextAt=restored.randomDialogue.nextAt;assert.ok(nextAt>=ending.dueAt+45000);
  runDueJobs(restored,config,nextAt-1);assert.equal(restored.chats.kakao.lia.length,3);
  runDueJobs(restored,config,nextAt);assert.equal(restored.randomDialogue.activeMember,'lia');assert.equal(restored.chats.kakao.lia.at(-1).text,config.dialogues.lia.nodes.invite.message);
  for(const id of ['ryujin','chaeryeong','yuna'])assert.equal(restored.welcomeDone[id],undefined);
});

test('random everyday conversations trigger each member once and keep their lock through all choices',()=>{
  const now=Date.now(),state=createState(config,now);completeOnboarding(state,'midzy.test','小雨',now,config);
  for(const m of config.members){startDialogue(state,config,'kakao',m.id,now);chooseDialogue(state,config,'kakao',m.id,'welcome','reply',now);}
  runDueJobs(state,config,now+1200);
  const seen=new Set();
  for(let turn=0;turn<5;turn++){
    const due=state.randomDialogue.nextAt;assert.ok(Number.isFinite(due));
    scheduleRandomDialogue(state,config,due,()=>0);runDueJobs(state,config,due);
    const member=state.randomDialogue.activeMember;assert.ok(!seen.has(member));seen.add(member);
    for(let step=0;step<5;step++){
      const session=state.dialogueSessions.kakao[member];if(session.finished)break;
      const choice=dialogueChoices(state,config,'kakao',member)[0];assert.ok(choice);
      assert.equal(chooseDialogue(state,config,'kakao',member,session.nodeId,choice.id,due+1000+step*1000),true);
      const job=state.jobs.find(j=>j.type==='dialogue'&&j.member===member);if(job)runDueJobs(state,config,job.dueAt);
    }
    assert.equal(state.randomDialogue.activeMember,null);
  }
  assert.equal(seen.size,5);assert.equal(state.randomDialogue.completed.length,5);assert.equal(state.randomDialogue.nextAt,null);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);const count=Object.values(restored.chats.kakao).reduce((n,chat)=>n+chat.length,0);
  runDueJobs(restored,config,now+86400000);assert.equal(Object.values(restored.chats.kakao).reduce((n,chat)=>n+chat.length,0),count);
});

test('older welcome saves add the missing final response without replaying the player choice',()=>{
  const state=createState(config,Date.now());completeOnboarding(state,'midzy.test','小雨',Date.now(),config);
  startDialogue(state,config,'kakao','yeji');chooseDialogue(state,config,'kakao','yeji','welcome','reply');
  state.jobs=[];state.welcomePending={};state.welcomeDone.yeji=true;state.dialogueSessions.kakao.yeji.finished=true;delete state.welcomeReplyVersion;
  const restored=validateSave(JSON.parse(JSON.stringify(state)),config);
  assert.equal(restored.chats.kakao.yeji.length,2);assert.equal(restored.welcomeDone.yeji,undefined);assert.equal(restored.randomDialogue.nextAt,null);
  const pending=restored.jobs.filter(j=>j.type==='welcome-reply');assert.equal(pending.length,1);
  const again=validateSave(JSON.parse(JSON.stringify(restored)),config);assert.equal(again.jobs.filter(j=>j.type==='welcome-reply').length,1);
  runDueJobs(again,config,pending[0].dueAt);assert.equal(again.chats.kakao.yeji.length,3);assert.equal(again.welcomeDone.yeji,true);assert.ok(again.randomDialogue.nextAt>pending[0].dueAt);
});

test('player fan comments arrive gradually after member comments and survive reload without duplicates',()=>{
  const c=fullConfig,now=Date.now(),state=createState(c,now),post=publish(state,c,{images:[photo('yeji')],caption:'我幫 Yeji 拍的'},now,fanRandom(85));
  const plans=state.jobs.filter(j=>j.type==='fan-comment');assert.ok(plans.length>=5&&plans.length<=10);
  assert.equal(new Set(plans.map(j=>j.member)).size,plans.length);assert.ok(plans.every(j=>state.fans[j.member]));
  runDueJobs(state,c,now+c.photoEvents.dmDelay);runDueJobs(state,c,now+c.photoEvents.dmDelay+c.photoEvents.postDelay);
  const owners=state.jobs.filter(j=>j.type==='post-comment'&&j.postId===post.id),firstFan=state.jobs.filter(j=>j.type==='fan-comment').sort((a,b)=>a.dueAt-b.dueAt)[0];
  assert.ok(firstFan.dueAt>Math.max(...owners.map(j=>j.dueAt)));
  runDueJobs(state,c,firstFan.dueAt-1);assert.equal(post.comments.filter(c=>state.fans[c.author]).length,0);
  const restored=validateSave(JSON.parse(JSON.stringify(state)),c);
  runDueJobs(restored,c,firstFan.dueAt);assert.equal(restored.posts.find(p=>p.id===post.id).comments.filter(c=>restored.fans[c.author]).length,1);
  const last=Math.max(...restored.jobs.filter(j=>j.type==='fan-comment').map(j=>j.dueAt));runDueJobs(restored,c,last);
  const saved=restored.posts.find(p=>p.id===post.id),comments=saved.comments.filter(c=>restored.fans[c.author]);assert.equal(comments.length,plans.length);
  const allowed=new Set(c.memberAudience.playerCompliments.flatMap(text=>c.memberAudience.emojis.map(emoji=>text.replaceAll('{{member}}','Yeji')+emoji)));
  assert.ok(comments.every(c=>allowed.has(c.text)));runDueJobs(restored,c,last+1);assert.equal(saved.comments.filter(c=>restored.fans[c.author]).length,plans.length);
  advancePostLikes(restored,c,now+60000);assert.ok(saved.fanLikes.length>=4);assert.ok(saved.fanLikes.every(id=>restored.fans[id]));
  validateSave(JSON.parse(JSON.stringify(restored)),c);
});

test('fan comments on arbitrary device uploads praise the photography without assuming a person',()=>{
  const state=createState(fullConfig,start),post=publish(state,fullConfig,{images:[{src:'data:image/jpeg;base64,YQ=='}]},start,fanRandom(94));
  const jobs=state.jobs.filter(j=>j.type==='fan-comment'),allowed=new Set(fullConfig.memberAudience.playerPhotoCompliments.flatMap(t=>fullConfig.memberAudience.emojis.map(e=>t+e)));
  assert.ok(jobs.length>=5);assert.ok(jobs.every(j=>allowed.has(j.text)&&!j.text.includes('{{member}}')));
  assert.equal(state.jobs.filter(j=>j.type.startsWith('photo-')).length,0);assert.equal(post.comments.length,0);
});
