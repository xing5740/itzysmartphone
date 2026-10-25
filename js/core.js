// 純資料與劇情狀態機；不依賴畫面，可直接用 node --test 驗證。
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function createPhotoDetails(config, random=Math.random) {
  const days=[1,2,3,4,5,6,7];
  for(let i=days.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[days[i],days[j]]=[days[j],days[i]];}
  return Object.fromEntries(config.members.map((m,i)=>[m.id,{daysAgo:days[i],description:config.photoDescriptions?.[m.id]||""}]));
}
export function photoLibrary(state, config) {
  return config.members.map(m=>({id:m.id,member:m.id,side:"me",src:config.assets.pairedPhoto(m.id,"me"),...state.photoDetails[m.id]})).sort((a,b)=>a.daysAgo-b.daysAgo);
}
export function personalize(state,text) {
  if(Array.isArray(text))return Array.from(text,part=>personalize(state,part));
  return String(text??"").replaceAll("{{nickname}}",state.profile.nickname||state.profile.name).replaceAll("{{name}}",state.profile.name);
}
// 句號代表下一則訊息；保留問號、驚嘆號、刪節號與帳號／網址／小數中的點。
export function splitChatText(text){
  if(Array.isArray(text))return Array.from(text).flatMap(splitChatText);
  return String(text??"").split(/[。．]+|(?<!\.)\.(?![.A-Za-z0-9_/])/u).map(part=>part.trim()).filter(Boolean);
}
function splitChatMessage(message){
  if(message.kind==="post")return [message];
  return splitChatText(message.text).map((text,index)=>({...message,id:index?uid():message.id,text}));
}
const chatNoticeText=text=>splitChatText(text).at(-1)||"";
export function completeOnboarding(state, username, nickname, now=Date.now(),config=null) {
  const handle=String(username).trim().replace(/^@/,""),name=String(nickname).trim();
  if(!/^[A-Za-z0-9_.]{1,30}$/.test(handle))throw new Error("Instagram ID 請使用 1–30 個英文字母、數字、底線或句點。");
  if(!name||name.length>40)throw new Error("稱呼請填寫 1–40 個字。");
  state.profile.username=handle;state.profile.nickname=name;state.profile.name=name;
  if(!state.onboardingComplete){const paused=Math.max(0,now-(state.setupStartedAt??now));state.jobs.forEach(j=>j.dueAt+=paused);}
  state.onboardingComplete=true;state.setupStartedAt=null;
  if(config)scheduleRandomDialogue(state,config,now);
}
function upgradeState(state, config) {
  state.fans??={};
  if(Object.keys(state.fans).length&&state.fanUsernameVersion!==2&&config.memberAudience)seedFans(state,config.memberAudience,Math.random);
  for(const post of state.posts)for(const comment of post.comments){
    if(!comment.id)comment.id=uid();
    if(comment.parentId===undefined)comment.parentId=null;
    if(comment.replyTo===undefined)comment.replyTo=null;
    if(!comment.likedBy)comment.likedBy=[];
  }
  if(!state.dialogueSessions)state.dialogueSessions={kakao:{},instagram:{}};
  upgradeDialogueFlow(state,config);
  upgradeWelcomeReplies(state,config);
  if(typeof state.profile.nickname!=="string")state.profile.nickname=state.profile.name;
  if(typeof state.onboardingComplete!=="boolean"){state.onboardingComplete=false;state.setupStartedAt=Date.now();}
  if(!state.photoDetails)state.photoDetails=createPhotoDetails(config);
  if(state.photoDescriptionVersion!==1){
    for(const m of config.members)if(state.photoDetails[m.id].description==="")state.photoDetails[m.id].description=config.photoDescriptions?.[m.id]||"";
    state.photoDescriptionVersion=1;
  }
  if(state.profile.bio==="서울의 작은 일상 ☁️\n和喜歡的人，收集一些日常。")state.profile.bio="";
  state.stories=state.stories.filter(story=>!story.demo||story.author==="me");
  upgradePhotoSequence(state,config);
  // 已有存檔的待發私訊也套用較短等待；成員發文和留言排程保持原樣。
  for(const job of state.jobs){
    const delay=job.type==="photo-dm"?config.photoEvents.dmDelay:job.type==="photo-follow-up"?config.photoEvents.followUpDelay:null;
    if(delay!==null)job.dueAt=Math.min(job.dueAt,Date.now()+delay);
  }
  for(const post of state.posts){initializePostAudience(state,config,post,Date.now());repairAutomaticComments(state,config,post);if(post.author==="me")queuePlayerFanComments(state,config,post,Date.now(),Math.random);}
  for(const channel of ["kakao","instagram"])for(const m of config.members){
    state.chats[channel][m.id]=state.chats[channel][m.id].flatMap(splitChatMessage);
  }
  scheduleRandomDialogue(state,config,Date.now());
  return state;
}
export function createState(config, now = Date.now()) {
  const chats = { kakao: {}, instagram: {} };
  for (const channel of Object.keys(chats)) for (const member of config.members) {
    chats[channel][member.id] = (config.initialMessages[channel]?.[member.id] || []).flatMap((text, i) => splitChatMessage({ id:uid(),sender:member.id,text,time:now - (5-i)*60000,read:false,kind:"text" }));
  }
  return {
    version:1, profile:{...config.player,nickname:config.player.nickname||""}, onboardingComplete:false,setupStartedAt:now,photoDetails:createPhotoDetails(config),photoDescriptionVersion:1,chats,posts:[],
    stories:config.seedStories ? config.members.map((m,i)=>({id:uid(),author:m.id,src:config.assets.pairedPhoto(m.id,"her"),createdAt:now-i*180000,seen:false,demo:true})) : [],
    events:{}, photoSequenceVersion:2,fans:{},dialogueFlowVersion:1,welcomeReplyVersion:1,welcomeDone:{},welcomePending:{},randomDialogue:{activeMember:null,completed:[],nextAt:null},dialogueSessions:{kakao:{},instagram:{}},jobs:(config.incomingMessages || []).map(x=>({...x,type:"incoming",dueAt:now+x.delay})), usedRules:[], bookmarked:[]
  };
}
export function addMessage(state, channel, member, text, sender=member, now=Date.now(), extra={}) {
  if (!state.chats[channel]?.[member]) throw new Error("無效的聊天室");
  const message = {id:uid(),sender,text,time:now,read:sender==="me",kind:"text",...extra};
  const messages=splitChatMessage(message);
  state.chats[channel][member].push(...messages);
  return messages.at(-1)||null;
}
export function queueKeywordReplies(state, config, channel, member, text, now=Date.now()) {
  for (const rule of config.keywordRules[channel] || []) {
    if (rule.member!==member || !(rule.keywords || []).some(k=>text.toLocaleLowerCase().includes(k.toLocaleLowerCase()))) continue;
    const key = `${channel}:${rule.id}`;
    if (rule.once && state.usedRules.includes(key)) continue;
    state.usedRules.push(key);
    (rule.replies || []).flatMap(splitChatText).forEach((reply,i)=>state.jobs.push({id:uid(),type:"incoming",channel,member,text:reply,dueAt:now+(rule.delay??1200)*(i+1)}));
  }
}
function dialogueScript(config,channel,member) {
  return config.dialogueChannels?.includes(channel)?config.dialogues?.[member]:null;
}
export function queueEmojiReplies(state,config,channel,member,text,now=Date.now(),random=Math.random) {
  const settings=config.kakaoEmoji;
  if(channel!=="kakao"||!settings?.value||text.trim()!==settings.value||!state.chats.kakao[member])return false;
  const variants=settings.replies?.[member];
  if(!variants?.length)return false;
  const selected=variants[Math.floor(random()*variants.length)];
  const replies=splitChatText(selected);
  replies.forEach((reply,i)=>state.jobs.push({id:uid(),type:"incoming",channel,member,text:reply,dueAt:now+(settings.delay??900)*(i+1)}));
  return replies.length>0;
}
function queueDialogueNode(state,channel,member,nodeId,now,delay=900) {
  const id=uid();
  state.dialogueSessions[channel][member].pending=id;
  state.jobs.push({id,type:"dialogue",channel,member,nodeId,dueAt:now+delay});
}
export function startDialogue(state,config,channel,member,now=Date.now()) {
  const script=dialogueScript(config,channel,member);
  if(!script?.nodes?.[script.start]||!state.onboardingComplete)return false;
  const session=state.dialogueSessions[channel][member];
  if(session&&(session.pending||script.nodes[session.nodeId]||session.finished))return false;
  state.dialogueSessions[channel][member]={nodeId:null,pending:null,finished:false};
  if(script.nodes[script.start].initial)state.dialogueSessions[channel][member].nodeId=script.start;
  else queueDialogueNode(state,channel,member,script.start,now,script.delay??600);
  return true;
}
export function dialogueChoices(state,config,channel,member) {
  const session=state.dialogueSessions[channel]?.[member];
  if(!session||session.pending||session.finished)return [];
  if(channel==="kakao"&&state.welcomePending?.[member]&&dialogueScript(config,channel,member)?.nodes[session.nodeId]?.initial)return [];
  if(session.random&&state.randomDialogue?.activeMember!==member)return [];
  return dialogueScript(config,channel,member)?.nodes?.[session.nodeId]?.choices||[];
}
export function chooseDialogue(state,config,channel,member,nodeId,choiceId,now=Date.now()) {
  const script=dialogueScript(config,channel,member);
  if(channel==="kakao"&&nodeId===script?.start&&script.nodes[nodeId]?.initial){
    if(!state.onboardingComplete||state.welcomeDone?.[member]||state.welcomePending?.[member])return false;
    const choice=script.nodes[nodeId].choices?.find(c=>c.id===choiceId);if(!choice)return false;
    addMessage(state,channel,member,personalize(state,choice.text),"me",now);
    queueWelcomeReply(state,config,member,now);
    return true;
  }
  const session=state.dialogueSessions[channel]?.[member];
  if(!session||session.pending||session.finished||session.nodeId!==nodeId)return false;
  if(session.random&&state.randomDialogue?.activeMember!==member)return false;
  const choice=dialogueChoices(state,config,channel,member).find(c=>c.id===choiceId);
  if(!choice)return false;
  if(choice.next&&!script.nodes[choice.next])throw new Error("這個對話選項尚未設定完整。");
  addMessage(state,channel,member,personalize(state,choice.text),"me",now);
  if(choice.next)queueDialogueNode(state,channel,member,choice.next,now,choice.delay??900);
  else {
    session.finished=true;
    if(channel==="kakao"&&script.nodes[nodeId].initial){state.welcomeDone??={};state.welcomeDone[member]=true;}
    finishRandomDialogue(state,config,member,now);
    scheduleRandomDialogue(state,config,now);
  }
  return true;
}
function queueWelcomeReply(state,config,member,now) {
  const script=config.dialogues[member],node=script.nodes[script.start],id=uid();
  state.welcomePending??={};state.welcomePending[member]=id;
  state.jobs.push({id,type:"welcome-reply",channel:"kakao",member,text:node.response,dueAt:now+(node.responseDelay??1200)});
}
function upgradeWelcomeReplies(state,config) {
  state.welcomePending??={};
  if(state.welcomeReplyVersion===1)return;
  for(const m of config.members){
    const script=config.dialogues[m.id],node=script?.nodes[script.start];
    if(!node?.initial||!state.welcomeDone[m.id])continue;
    const messages=state.chats.kakao[m.id];
    if(messages.some(message=>message.welcomeReply))continue;
    delete state.welcomeDone[m.id];
    const outgoing=messages.filter(message=>message.sender==="me").flatMap(message=>splitChatText(message.text));
    const answered=node.choices.some(choice=>{
      const parts=splitChatText(personalize(state,choice.text));
      return parts.length&&outgoing.some((_,index)=>parts.every((part,offset)=>outgoing[index+offset]===part));
    });
    if(answered&&!state.welcomePending[m.id])queueWelcomeReply(state,config,m.id,Date.now());
    const session=state.dialogueSessions.kakao[m.id];if(session&&!session.random&&session.nodeId===script.start)session.finished=false;
  }
  state.welcomeReplyVersion=1;
}
function upgradeDialogueFlow(state,config) {
  state.welcomeDone??={};state.randomDialogue??={activeMember:null,completed:[],nextAt:null};
  if(state.dialogueFlowVersion===1)return;
  for(const m of config.members){
    const session=state.dialogueSessions.kakao[m.id];if(!session)continue;
    if(session.nodeId==="welcome"){
      if(session.pending){state.jobs=state.jobs.filter(j=>j.id!==session.pending);session.pending=null;session.finished=true;}
      if(session.finished)state.welcomeDone[m.id]=true;
    }else{
      state.welcomeDone[m.id]=true;session.random=true;
      if(session.finished)state.randomDialogue.completed.push(m.id);
      else state.randomDialogue.activeMember??=m.id;
    }
  }
  state.dialogueFlowVersion=1;
  scheduleRandomDialogue(state,config,Date.now());
}
function finishRandomDialogue(state,config,member,now) {
  const session=state.dialogueSessions.kakao[member],r=state.randomDialogue;
  if(!session?.random||!session.finished||r?.activeMember!==member)return;
  r.completed=[...new Set([...r.completed,member])];r.activeMember=null;r.nextAt=null;
  scheduleRandomDialogue(state,config,now);
}
export function scheduleRandomDialogue(state,config,now=Date.now(),random=Math.random) {
  const settings=config.randomDialogues;
  if(!settings?.enabled||!state.onboardingComplete||!config.dialogueChannels?.includes("kakao"))return;
  const r=state.randomDialogue??={activeMember:null,completed:[],nextAt:null};
  if(r.activeMember){
    const script=config.dialogues[r.activeMember];
    if(!script.nodes[script.start]?.initial||state.welcomeDone?.[r.activeMember])return;
    r.activeMember=null;r.nextAt=null;
  }
  const eligible=config.members.filter(m=>state.welcomeDone?.[m.id]&&!r.completed.includes(m.id)&&config.dialogues[m.id]?.nodes[config.dialogues[m.id].randomStart]);
  if(!eligible.length){r.nextAt=null;return;}
  if(r.nextAt===null){r.nextAt=now+randomInteger(settings.delay,random);return;}
  if(now<r.nextAt)return;
  const member=eligible[Math.floor(random()*eligible.length)].id;
  r.activeMember=member;r.nextAt=null;
  const old=state.dialogueSessions.kakao[member];
  if(old?.random&&!old.finished)return;
  state.dialogueSessions.kakao[member]={nodeId:null,pending:null,finished:false,random:true};
  queueDialogueNode(state,"kakao",member,config.dialogues[member].randomStart,now,0);
}
function commentContext(state,config,post,memberId) {
  const normalize=text=>String(text||"").toLocaleLowerCase().replace(/\s+/g,"");
  const images=post.images.filter(p=>p.member===memberId);
  const fallback=images[0]?.description??state.photoDetails?.[memberId]?.description??config.photoDescriptions?.[memberId]??"";
  let description=post.caption.trim();
  if(description&&new Set(post.images.map(p=>p.member).filter(Boolean)).size>1){
    const matches=(text,m)=>[m.id,m.name,m.korean].filter(Boolean).some(name=>normalize(text).includes(normalize(name)));
    const named=config.members.filter(m=>matches(description,m));
    if(named.length){
      const m=config.members.find(m=>m.id===memberId);
      const ownClauses=description.split(/[，,。；;\n]|以及|還有|另外/).filter(text=>matches(text,m));
      description=ownClauses.length?ownClauses.join("，"):fallback;
    }
  }
  const text=normalize(description||fallback);
  return config.postComments.contexts?.find(rule=>rule.keywords.some(word=>text.includes(normalize(word)))&&!(rule.exclude||[]).some(word=>text.includes(normalize(word))))||null;
}
// 同一篇貼文的自動留言不可只換標點或 emoji 重複出現。
function commentKey(text){return String(text).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");}
function chooseComment(state,options,used,random=Math.random){
  const values=[...new Set(options.filter(t=>typeof t==="string"&&t.trim()).map(t=>personalize(state,t)))].filter(t=>!used.has(commentKey(t)));
  if(!values.length)return null;
  const text=values[Math.floor(random()*values.length)];used.add(commentKey(text));return text;
}
function memberCommentOptions(state,config,post,id){
  const settings=config.postComments;
  const owners=[...new Set(post.images.filter(p=>p.side==="me").map(p=>p.member))];
  const owner=owners.includes(id),context=settings?commentContext(state,config,post,owner?id:owners[0]):null;
  return [...(context?.[owner?"memberReplies":"otherReplies"]||settings?.[owner?"memberReplies":"otherReplies"]?.[id]||[]),
    ...(owner?["這張我很喜歡 ❤️","這張我先存起來了","謝謝你留下這個瞬間"]:["這張真好看！","照片看起來好舒服","這個畫面我喜歡"])];
}
function automaticCommentOptions(state,config,post,id){
  if(config.members.some(m=>m.id===id))return memberCommentOptions(state,config,post,id);
  const pictured=config.members.find(m=>post.author===m.id||post.images.some(image=>image.member===m.id));
  const audience=config.memberAudience;
  const lines=post.author!=="me"?audience?.compliments:pictured?audience?.playerCompliments:audience?.playerPhotoCompliments;
  return (lines||[]).map(text=>text.replaceAll("{{member}}",pictured?.name||""));
}
function repairAutomaticComments(state,config,post){
  const used=new Set();
  // 玩家寫的留言與回覆保留原文，只替自動產生的根留言避開重複。
  for(const comment of post.comments.filter(c=>c.author==="me"||c.parentId))used.add(commentKey(comment.text));
  for(const comment of post.comments.filter(c=>c.author!=="me"&&!c.parentId)){
    if(used.has(commentKey(comment.text))){
      const replacement=chooseComment(state,automaticCommentOptions(state,config,post,comment.author),used);
      if(replacement)comment.text=replacement;
    }
    used.add(commentKey(comment.text));
  }
}
function addMemberPostLike(post,id){
  post.memberLikes??=[];
  if(post.memberLikes.includes(id))return false;
  post.memberLikes.push(id);post.likes++;return true;
}
function queuePostComments(state,config,post,now,random) {
  const settings=config.postComments;
  if(!settings)return;
  const owners=[...new Set(post.images.filter(p=>p.side==="me"&&config.members.some(m=>m.id===p.member)).map(p=>p.member))];
  if(!owners.length)return;
  const used=new Set([...post.comments.map(c=>c.text),...state.jobs.filter(j=>["post-comment","fan-comment"].includes(j.type)&&j.postId===post.id).map(j=>j.text)].map(text=>commentKey(personalize(state,text))));
  const choose=(texts,fallback)=>chooseComment(state,texts||[],used,random)||chooseComment(state,[fallback],used,random);
  const afterPosts=owners.filter(id=>state.events[id]?.userShareId===post.id&&state.events[id].phase!=="done");
  const anchor=now+(afterPosts.length?config.photoEvents.dmDelay+config.photoEvents.postDelay:0);
  const queue=(member,text,dueAt)=>text&&state.jobs.push({id:uid(),type:"post-comment",member,postId:post.id,text,dueAt:anchor+dueAt-now,...(afterPosts.length?{afterPosts,delayAfterPosts:dueAt-now}:{})});
  const contexts=owners.map(id=>commentContext(state,config,post,id));
  const sharedContext=contexts.every(c=>c?.id===contexts[0]?.id)?contexts[0]:null;
  owners.forEach((id,i)=>queue(id,choose(contexts[i]?.memberReplies||settings.memberReplies?.[id],"這張我很喜歡 ❤️"),now+(settings.memberDelay??15000)+i*(settings.spacing??3000)));
  const others=config.members.filter(m=>!owners.includes(m.id));
  for(let i=others.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[others[i],others[j]]=[others[j],others[i]];}
  const firstDelay=Math.max(settings.otherDelay??20000,(settings.memberDelay??15000)+owners.length*(settings.spacing??3000));
  let count=0;
  for(const m of others){
    if(count>=(settings.maxOthers??2))break;
    if(random()>=(settings.otherChance??0.5))continue;
    queue(m.id,choose(sharedContext?.otherReplies||settings.otherReplies?.[m.id],"這張真好看！"),now+firstDelay+count*(settings.spacing??3000));
    count++;
  }
}
function releasePostComments(state,postId,now) {
  for(const job of state.jobs.filter(j=>["post-comment","fan-comment"].includes(j.type)&&j.postId===postId&&j.afterPosts)){
    if(job.afterPosts.every(id=>state.events[id]?.counterpartId&&state.posts.some(p=>p.id===state.events[id].counterpartId))){
      job.dueAt=now+job.delayAfterPosts;delete job.afterPosts;delete job.delayAfterPosts;
    }
  }
}
function upgradePhotoSequence(state,config) {
  const removedObservers=[];
  state.jobs=state.jobs.flatMap(job=>{
    if(job.type!=="photo-observer")return [job];
    // 第二版的舊排程名稱實際上已是本人追問；更早版本才會傳給另一位成員。
    if(state.photoSequenceVersion===2)return [{...job,type:"photo-follow-up"}];
    removedObservers.push(job.member);return [];
  });
  if(state.photoSequenceVersion===2)return;
  for(const job of state.jobs.filter(j=>j.type==="photo-post")){
    const questionParts=splitChatText(config.photoEvents.scripts[job.member].question);
    const question=[...state.chats.instagram[job.member]].reverse().find(m=>m.sender===job.member&&(m.text===questionParts[0]||splitChatText(m.text).join("\n")===questionParts.join("\n")));
    if(question)job.dueAt=question.time+config.photoEvents.postDelay;
  }
  for(const post of state.posts.filter(p=>p.author==="me")){
    const owners=Object.keys(state.events).filter(id=>state.events[id].userShareId===post.id&&state.events[id].phase!=="done");
    if(!owners.length)continue;
    const comments=state.jobs.filter(j=>j.type==="post-comment"&&j.postId===post.id);
    comments.forEach((j,i)=>{j.afterPosts=owners;j.delayAfterPosts=(config.postComments?.memberDelay??15000)+i*(config.postComments?.spacing??3000);});
    if(owners.every(id=>state.events[id].counterpartId))releasePostComments(state,post.id,Date.now());
  }
  for(const job of state.jobs.filter(j=>j.type==="photo-follow-up")){
    const postId=state.events[job.member]?.userShareId;
    job.dueAt=Math.max(Date.now(),...state.jobs.filter(j=>j.type==="post-comment"&&j.postId===postId).map(j=>j.dueAt))+config.photoEvents.followUpDelay;
  }
  state.photoSequenceVersion=2;
  for(const id of removedObservers)if(state.events[id]?.phase==="posted")state.events[id].phase="done";
}
export function toggleCommentLike(state,postId,commentId) {
  const comment=state.posts.find(p=>p.id===postId)?.comments.find(c=>c.id===commentId);
  if(!comment)return false;
  comment.likedBy??=[];
  const index=comment.likedBy.indexOf("me");
  if(index<0)comment.likedBy.push("me");else comment.likedBy.splice(index,1);
  return true;
}
function randomInteger(range,random) {return range[0]+Math.floor(random()*(range[1]-range[0]+1));}
function shuffled(values,random) {
  const items=[...values];for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}
  return items;
}
function fanUsername(settings,used,random) {
  const pick=values=>values[Math.floor(random()*values.length)];
  const names=settings.usernameNames,words=settings.usernameWords,suffixes=settings.usernameSuffixes;
  for(let attempt=0;;attempt++){
    let candidate;
    if(attempt<24){
      const name=pick(names),word=pick(words);
      let word2=pick(words);if(word2===word)word2=words[(words.indexOf(word)+1)%words.length];
      const parts={name,word,word2,surname:pick(settings.usernameSurnames),prefix:pick(settings.usernamePrefixes),suffix:pick(suffixes),initial:name[0],stretchedName:name.replace(/[aeiou]/,v=>v.repeat(2))};
      candidate=pick(settings.usernameFormats).replace(/\{\{(\w+)\}\}/g,(_,key)=>parts[key]);
      if(random()<(settings.usernameNumberChance??0.28)){
        const number=pick([String(randomInteger([2,99],random)),String(randomInteger([1995,2008],random)),`${String(randomInteger([1,12],random)).padStart(2,'0')}${String(randomInteger([1,28],random)).padStart(2,'0')}`]);
        candidate+=pick(['','_','.'])+number;
      }
    }else{
      // 隨機嘗試多次仍撞名時，改用詞組補足，避免重複亂數造成無限重試。
      const index=used.size+attempt-24;
      candidate=`${names[index%names.length]}.${words[Math.floor(index/names.length)%words.length]}_${suffixes[Math.floor(index/(names.length*words.length))%suffixes.length]}`;
    }
    candidate=candidate.slice(0,30).replace(/\.+$/,'');
    if(!used.has(candidate.toLowerCase())){used.add(candidate.toLowerCase());return candidate;}
  }
}
function seedFans(state,settings,random) {
  state.fans??={};
  const used=new Set([...Object.values(state.fans).map(f=>f.username).filter(name=>!/^\w+\.midzy_\d+_\d{3}$/.test(name)),state.profile.username].map(name=>name.toLowerCase()));
  for(const fan of Object.values(state.fans)){
    if(/^\w+\.midzy_\d+_\d{3}$/.test(fan.username))fan.username=fanUsername(settings,used,random);
    delete fan.name;
  }
  for(let i=0;i<settings.fanPoolSize;i++){
    const id=`fan-${i+1}`;if(state.fans[id])continue;
    state.fans[id]={id,username:fanUsername(settings,used,random),color:settings.colors[Math.floor(random()*settings.colors.length)]};
  }
  state.fanUsernameVersion=2;
}
function fanCommentPool(settings,lines,member,count,random,excluded=[]) {
  const used=new Set(excluded.map(commentKey)),bare=[];
  for(const line of lines){const text=line.replaceAll("{{member}}",member),key=commentKey(text);if(!used.has(key)){used.add(key);bare.push(text);}}
  const emojis=settings.emojis.filter(Boolean);
  return shuffled(bare,random).map(text=>random()<(settings.emojiChance??0.22)&&emojis.length?text+emojis[Math.floor(random()*emojis.length)]:text);
}
function queuePlayerFanComments(state,config,post,now,random) {
  const settings=config.memberAudience;
  if(!settings?.playerCommentCount||post.playerFanCommentsQueued)return;
  const count=randomInteger(settings.playerCommentCount,random);
  post.playerFanCommentsQueued=true;if(!count)return;
  seedFans(state,settings,random);
  const member=config.members.find(m=>post.images.some(image=>image.member===m.id));
  const excluded=[...post.comments.map(c=>c.text),...state.jobs.filter(j=>j.postId===post.id&&["post-comment","fan-comment"].includes(j.type)).map(j=>personalize(state,j.text))];
  const texts=fanCommentPool(settings,member?settings.playerCompliments:settings.playerPhotoCompliments,member?.name||"",count,random,excluded);
  const members=state.jobs.filter(j=>j.type==="post-comment"&&j.postId===post.id);
  const afterPosts=config.members.filter(m=>state.events[m.id]?.userShareId===post.id&&["queued","asked"].includes(state.events[m.id].phase)).map(m=>m.id);
  const anchor=now+(afterPosts.length?config.photoEvents.dmDelay+config.photoEvents.postDelay:0);
  let offset=Math.max(0,...members.map(j=>j.delayAfterPosts??Math.max(0,j.dueAt-anchor)))+randomInteger(settings.playerCommentDelay,random);
  const accounts=shuffled(Object.values(state.fans).filter(f=>!post.comments.some(c=>c.author===f.id)),random).slice(0,Math.min(count,texts.length));
  for(const [index,fan] of accounts.entries()){
    state.jobs.push({id:uid(),type:"fan-comment",member:fan.id,postId:post.id,text:texts[index],dueAt:anchor+offset,...(afterPosts.length?{afterPosts,delayAfterPosts:offset}:{})});
    offset+=randomInteger(settings.playerCommentSpacing,random);
  }
}
export function initializePostAudience(state,config,post,now=Date.now(),random=Math.random) {
  post.memberLikes??=[];
  const settings=config.memberAudience;if(!settings)return;
  const m=config.members.find(m=>m.id===post.author),ownLike=post.liked?1:0;
  if(!post.engagement){
    const base=m?Math.max(post.likes-ownLike-post.memberLikes.length,randomInteger(settings.initialLikes,random)):Math.max(0,post.likes-ownLike-post.memberLikes.length);
    const playerRate=Array.isArray(settings.playerLikesPerMinute)?randomInteger(settings.playerLikesPerMinute,random):settings.playerLikesPerMinute;
    post.engagement={baseLikes:base,organicLikes:base,likesPerMinute:m?randomInteger(settings.likesPerMinute,random):playerRate,startedAt:post.time,maxLikes:m?null:Math.max(base,settings.playerMaxLikes),audienceVersion:2};
    post.likes=base+ownLike+post.memberLikes.length;
  }
  if(!m&&post.engagement.audienceVersion!==2){
    const e=post.engagement;e.baseLikes=e.organicLikes;e.startedAt=now;
    e.likesPerMinute=Array.isArray(settings.playerLikesPerMinute)?randomInteger(settings.playerLikesPerMinute,random):settings.playerLikesPerMinute;
    e.maxLikes=Math.max(e.organicLikes,settings.playerMaxLikes);e.audienceVersion=2;
  }
  if(!m)return;
  if(post.fanCommentsSeeded){
    if(post.fanCommentStyle!==3){
      const comments=post.comments.filter(c=>state.fans?.[c.author]&&!c.parentId);
      const texts=fanCommentPool(settings,settings.compliments,m.name,comments.length,random,post.comments.filter(c=>!comments.includes(c)).map(c=>c.text));
      comments.forEach((comment,index)=>{if(texts[index])comment.text=texts[index];});post.fanCommentStyle=3;
    }
    return;
  }
  seedFans(state,settings,random);
  const existing=post.comments.filter(c=>state.fans[c.author]).length;
  const count=Math.max(0,randomInteger(settings.commentCount,random)-existing);
  const texts=fanCommentPool(settings,settings.compliments,m.name,count,random,post.comments.map(c=>c.text));
  const accounts=shuffled(Object.values(state.fans).filter(fan=>!post.comments.some(c=>c.author===fan.id)),random).slice(0,Math.min(count,texts.length));
  accounts.forEach((fan,i)=>post.comments.push({id:uid(),author:fan.id,text:texts[i],time:post.time+Math.floor(Math.min(Math.max(0,now-post.time),600000)*i/Math.max(1,accounts.length)),parentId:null,replyTo:null,likedBy:[]}));
  post.fanCommentsSeeded=true;
  post.fanCommentStyle=3;
}
export function advancePostLikes(state,config,now=Date.now()) {
  let changed=false;
  for(const post of state.posts){
    initializePostAudience(state,config,post,now);
    const e=post.engagement;if(!e)continue;
    let target=e.baseLikes+Math.floor(Math.max(0,now-e.startedAt)*e.likesPerMinute/60000);
    if(e.maxLikes!==null)target=Math.min(target,e.maxLikes);
    if(target>e.organicLikes){
      if(post.author==="me"){
        if(!Object.keys(state.fans).length)seedFans(state,config.memberAudience,Math.random);
        post.fanLikes??=[];
        const accounts=shuffled(Object.keys(state.fans).filter(id=>!post.fanLikes.includes(id)),Math.random);
        post.fanLikes.push(...accounts.slice(0,target-e.organicLikes));
      }
      post.likes+=target-e.organicLikes;e.organicLikes=target;changed=true;
    }
  }
  return changed;
}
export function addComment(state,config,postId,text,replyTo=null,now=Date.now()) {
  const post=state.posts.find(p=>p.id===postId),body=String(text??"").trim();
  if(!post||!body)return null;
  const target=replyTo?post.comments.find(c=>c.id===replyTo):null;
  if(replyTo&&!target)return null;
  const comment={id:uid(),author:"me",text:body,time:now,parentId:target?(target.parentId||target.id):null,replyTo:target?.id||null,likedBy:[]};
  post.comments.push(comment);
  if(target&&(config.members.some(m=>m.id===target.author)||state.fans?.[target.author]))state.jobs.push({id:uid(),type:"comment-like",member:target.author,postId,commentId:comment.id,dueAt:now+(config.postComments?.replyLikeDelay??10000)});
  return comment;
}
export function publish(state, config, {type="post", images, caption=""}, now=Date.now(),random=Math.random) {
  if (!images?.length) throw new Error("請先選擇照片");
  if(type!=="story"&&images.length>1)throw new Error("一則貼文只能上傳一張照片");
  const item = type==="story"
    ? {id:uid(),author:"me",src:images[0].src,createdAt:now,seen:false}
    : {id:uid(),author:"me",images:images.map(x=>({...x})),caption,time:now,likes:0,liked:false,comments:[],slide:0};
  if (type==="story") state.stories.push(item); else state.posts.unshift(item);
  if(type!=="story")initializePostAudience(state,config,item,now,random);
  const selected = type==="story" ? images.slice(0,1) : images;
  for (const image of selected) {
    const member = config.members.find(m=>m.id===image.member);
    if (image.side!=="me" || !member || state.events[member.id]) continue;
    state.events[member.id]={phase:"queued",userShareId:item.id,userShareType:type};
    state.jobs.push({id:uid(),type:"photo-dm",member:member.id,dueAt:now+config.photoEvents.dmDelay});
  }
  if(type!=="story")queuePostComments(state,config,item,now,random);
  if(type!=="story")queuePlayerFanComments(state,config,item,now,random);
  return item;
}
// 發文相關私訊逐則傳送，下一則從上一則實際送達後起算，避免背景分頁補送時擠在一起。
function queuePhotoReplyPart(state,config,member,parts,stage,now){
  const [text,...remaining]=parts;if(!text)return;
  state.jobs.push({id:uid(),type:"incoming",channel:"instagram",member,text,photoReply:stage,remaining,dueAt:now+(config.photoEvents.messageSpacing??1500)});
}
function sendPhotoReply(state,config,member,text,stage,now){
  const [first,...rest]=splitChatText(text);if(!first)return "";
  addMessage(state,"instagram",member,first,member,now);
  queuePhotoReplyPart(state,config,member,rest,stage,now);
  return first;
}
export function runDueJobs(state, config, now=Date.now()) {
  const notices = [];
  scheduleRandomDialogue(state,config,now);
  const due=state.jobs.filter(j=>j.dueAt<=now).sort((a,b)=>a.dueAt-b.dueAt);
  for (const job of due) {
    if(job.dueAt>now)continue;
    if(["post-comment","fan-comment"].includes(job.type)&&job.afterPosts)continue;
    if(job.type==="dialogue"&&job.channel==="kakao"&&state.dialogueSessions.kakao[job.member]?.random&&state.randomDialogue?.activeMember!==job.member)continue;
    state.jobs=state.jobs.filter(j=>j.id!==job.id);
    const m=config.members.find(x=>x.id===job.member)||(["comment-like","fan-comment"].includes(job.type)?state.fans?.[job.member]:null);
    if (!m) continue;
    const script=config.photoEvents.scripts[m.id];
    if(job.type==="welcome-reply"){
      if(state.welcomePending?.[m.id]!==job.id)continue;
      const message=addMessage(state,"kakao",m.id,job.text,m.id,now,{welcomeReply:true});
      delete state.welcomePending[m.id];state.welcomeDone[m.id]=true;
      const session=state.dialogueSessions.kakao[m.id];
      if(session&&!session.random&&config.dialogues[m.id].nodes[session.nodeId]?.initial)session.finished=true;
      scheduleRandomDialogue(state,config,now);
      notices.push({channel:"kakao",member:m.id,text:message?.text||""});
    }else if(job.type==="comment-like"){
      const post=state.posts.find(p=>p.id===job.postId),comment=post?.comments.find(c=>c.id===job.commentId);
      const target=post?.comments.find(c=>c.id===comment?.replyTo);
      if(!comment||comment.author!=="me"||target?.author!==m.id)continue;
      comment.likedBy??=[];
      if(comment.likedBy.includes(m.id))continue;
      comment.likedBy.push(m.id);
      notices.push({kind:"comment-like",postId:post.id,commentId:comment.id,member:m.id,text:"對你的回覆說讚"});
    } else if(["post-comment","fan-comment"].includes(job.type)){
      const post=state.posts.find(p=>p.id===job.postId);
      if(!post||post.author!=="me"||post.comments.some(c=>c.id===job.id))continue;
      const used=new Set(post.comments.map(c=>commentKey(c.text)));
      let text=personalize(state,job.text);
      if(used.has(commentKey(text))){
        const options=automaticCommentOptions(state,config,post,m.id);
        text=chooseComment(state,options,used);if(!text)continue;
      }
      if(job.type==="post-comment")addMemberPostLike(post,m.id);
      post.comments.push({id:job.id,author:m.id,text,time:now,parentId:null,replyTo:null,likedBy:[]});
      if(job.type==="post-comment")for(const followUp of state.jobs.filter(j=>j.type==="photo-follow-up"&&state.events[j.member]?.userShareId===post.id))followUp.dueAt=Math.max(followUp.dueAt,now+config.photoEvents.followUpDelay);
      notices.push({kind:"comment",postId:post.id,commentId:job.id,member:m.id,text:`在你的貼文留言：${text}`,quiet:job.type==="fan-comment"});
    } else if(job.type==="dialogue") {
      const session=state.dialogueSessions[job.channel]?.[m.id];
      if(!session||session.pending!==job.id)continue;
      const node=dialogueScript(config,job.channel,m.id)?.nodes?.[job.nodeId];
      session.pending=null;
      if(!node){session.nodeId=null;session.finished=true;if(job.channel==="kakao")finishRandomDialogue(state,config,m.id,now);notices.push({channel:job.channel,member:m.id,text:""});continue;}
      session.nodeId=job.nodeId;session.finished=!(node.choices?.length);
      if(node.message){addMessage(state,job.channel,m.id,node.message,m.id,now);notices.push({channel:job.channel,member:m.id,text:chatNoticeText(node.message)});}
      else notices.push({channel:job.channel,member:m.id,text:""});
      if(job.channel==="kakao")finishRandomDialogue(state,config,m.id,now);
    } else if (job.type==="incoming") {
      if (!state.chats[job.channel]?.[job.member] || !job.text) continue;
      addMessage(state,job.channel,m.id,job.text,m.id,now);
      if(job.photoReply)queuePhotoReplyPart(state,config,m.id,job.remaining,job.photoReply,now);
      notices.push({channel:job.channel,member:m.id,text:chatNoticeText(job.text)});
    } else if (job.type==="photo-dm" && state.events[m.id]?.phase==="queued") {
      const first=sendPhotoReply(state,config,m.id,script.question,"question",now);
      state.events[m.id].phase="asked";
      state.jobs.push({id:uid(),type:"photo-post",member:m.id,dueAt:now+config.photoEvents.postDelay});
      notices.push({channel:"instagram",member:m.id,text:first});
    } else if (job.type==="photo-post" && state.events[m.id]?.phase==="asked") {
      const pending=state.jobs.find(j=>j.type==="incoming"&&j.member===m.id&&j.photoReply==="question");
      if(pending){state.jobs.push({...job,dueAt:Math.max(now+1,pending.dueAt+1)});continue;}
      const post={id:uid(),author:m.id,images:[{src:config.assets.pairedPhoto(m.id,"her"),member:m.id,side:"her"}],caption:script.caption,time:now,likes:0,liked:false,comments:[],slide:0};
      initializePostAudience(state,config,post,now);
      state.posts.unshift(post);
      state.events[m.id].phase="posted";
      state.events[m.id].counterpartId=post.id;
      const userPostId=state.events[m.id].userShareId;
      releasePostComments(state,userPostId,now);
      const commentTimes=state.jobs.filter(j=>j.type==="post-comment"&&j.postId===userPostId).map(j=>j.dueAt);
      state.jobs.push({id:uid(),type:"photo-follow-up",member:m.id,dueAt:Math.max(now,...commentTimes)+config.photoEvents.followUpDelay});
      notices.push({postId:post.id,member:m.id,text:`${m.name} 發佈了一則新貼文`});
    } else if (job.type==="photo-follow-up" && state.events[m.id]?.phase==="posted") {
      const event=state.events[m.id];
      if(state.jobs.some(j=>j.type==="post-comment"&&j.postId===event.userShareId)){
        state.jobs.push({...job,dueAt:now+config.photoEvents.followUpDelay});continue;
      }
      const userExists=event.userShareType==="story" ? state.stories.some(s=>s.id===event.userShareId) : state.posts.some(p=>p.id===event.userShareId);
      if (userExists && state.posts.some(p=>p.id===event.counterpartId)) {
        const first=sendPhotoReply(state,config,m.id,script.followUp,"followUp",now);
        notices.push({channel:"instagram",member:m.id,text:first});
      }
      event.phase="done";
    }
  }
  return notices;
}
export function unreadCount(state, channel, member) {
  const lists=member ? [state.chats[channel][member]] : Object.values(state.chats[channel]);
  return lists.reduce((sum,messages)=>sum+messages.filter(m=>!m.read && m.sender!=="me").length,0);
}
export function validateSave(value, config) {
  const members=config.members.map(m=>m.id),fans=value?.fans;
  if(fans&&(typeof fans!=="object"||Array.isArray(fans)||Object.entries(fans).some(([id,f])=>!/^fan-\d+$/.test(id)||!f||f.id!==id||typeof f.username!=="string"||(f.name!==undefined&&typeof f.name!=="string")||!/^#[a-fA-F0-9]{6}$/.test(f.color))))throw new Error("存檔的粉絲資料不完整");
  const authors=["me",...members,...Object.keys(fans||{})];
  if (!value || value.version!==1 || !value.profile || typeof value.profile.name!=="string" || typeof value.profile.username!=="string" || typeof value.profile.bio!=="string" || typeof value.profile.avatar!=="string" || !Array.isArray(value.posts) || !Array.isArray(value.stories) || !Array.isArray(value.jobs) || !Array.isArray(value.usedRules) || !Array.isArray(value.bookmarked) || !value.events || Array.isArray(value.events) || !value.chats) throw new Error("這不是有效的 itzy phone 存檔");
  for (const channel of ["kakao","instagram"]) for (const m of config.members) {
    if (!Array.isArray(value.chats[channel]?.[m.id]) || value.chats[channel][m.id].some(x=>!x || typeof x.text!=="string" || !Number.isFinite(x.time) || !["me",m.id].includes(x.sender) || !["text","post"].includes(x.kind) || (x.kind==="post"&&typeof x.postId!=="string"))) throw new Error("存檔的聊天資料不完整");
  }
  if(value.posts.some(p=>!p || typeof p.id!=="string" || !authors.includes(p.author) || !Number.isFinite(p.time) || !Number.isFinite(p.likes) || !Array.isArray(p.images) || !p.images.length || p.images.length>10 || !Array.isArray(p.comments) || typeof p.caption!=="string" || p.images.some(i=>!i || typeof i.src!=="string") || p.comments.some(c=>!c || !authors.includes(c.author) || typeof c.text!=="string" || !Number.isFinite(c.time)))) throw new Error("存檔的貼文資料不完整");
  if(value.posts.some(p=>p.engagement!==undefined&&(!p.engagement||["baseLikes","organicLikes","likesPerMinute","startedAt"].some(key=>!Number.isFinite(p.engagement[key])||(key!=="startedAt"&&p.engagement[key]<0))||(p.engagement.maxLikes!==null&&(!Number.isFinite(p.engagement.maxLikes)||p.engagement.maxLikes<0)))))throw new Error("存檔的貼文讚數資料不完整");
  if(value.posts.some(p=>p.memberLikes!==undefined&&(!Array.isArray(p.memberLikes)||p.memberLikes.some(id=>!members.includes(id)||id===p.author)||new Set(p.memberLikes).size!==p.memberLikes.length)))throw new Error("存檔的成員按讚資料不完整");
  if(value.posts.some(p=>p.fanLikes!==undefined&&(!Array.isArray(p.fanLikes)||p.fanLikes.some(id=>!fans?.[id])||new Set(p.fanLikes).size!==p.fanLikes.length)))throw new Error("存檔的粉絲按讚資料不完整");
  if(value.welcomeDone&&(typeof value.welcomeDone!=="object"||Array.isArray(value.welcomeDone)||Object.entries(value.welcomeDone).some(([id,done])=>!members.includes(id)||typeof done!=="boolean")))throw new Error("存檔的歡迎對話資料不完整");
  if(value.welcomePending&&(typeof value.welcomePending!=="object"||Array.isArray(value.welcomePending)||Object.entries(value.welcomePending).some(([member,id])=>!members.includes(member)||typeof id!=="string"||!value.jobs.some(j=>j.id===id&&j.type==="welcome-reply"&&j.member===member))))throw new Error("存檔的歡迎回應排程不完整");
  if(value.randomDialogue){
    const r=value.randomDialogue;
    if((r.activeMember!==null&&!members.includes(r.activeMember))||!Array.isArray(r.completed)||r.completed.some(id=>!members.includes(id))||new Set(r.completed).size!==r.completed.length||(r.nextAt!==null&&!Number.isFinite(r.nextAt)))throw new Error("存檔的隨機對話資料不完整");
  }
  for(const post of value.posts)for(const c of post.comments){
    if((c.id!==undefined&&typeof c.id!=="string")||(c.likedBy!==undefined&&(!Array.isArray(c.likedBy)||c.likedBy.some(id=>!authors.includes(id))||new Set(c.likedBy).size!==c.likedBy.length)))throw new Error("存檔的留言按讚資料不完整");
    if(c.parentId!==undefined&&c.parentId!==null&&!post.comments.some(root=>root.id===c.parentId&&root.id!==c.id&&!root.parentId))throw new Error("存檔的留言討論串不完整");
    if(c.replyTo!==undefined&&c.replyTo!==null&&!post.comments.some(target=>target.id===c.replyTo&&target.id!==c.id&&(target.parentId||target.id)===c.parentId))throw new Error("存檔的回覆對象不完整");
  }
  if(value.stories.some(s=>!s || typeof s.id!=="string" || !authors.includes(s.author) || typeof s.src!=="string" || !Number.isFinite(s.createdAt))) throw new Error("存檔的限時動態資料不完整");
  if(value.jobs.some(j=>!j || typeof j.id!=="string" || !(members.includes(j.member)||(["comment-like","fan-comment"].includes(j.type)&&fans?.[j.member])) || !Number.isFinite(j.dueAt) || !["incoming","welcome-reply","dialogue","post-comment","fan-comment","comment-like","photo-dm","photo-post","photo-follow-up","photo-observer"].includes(j.type) || (["incoming","welcome-reply"].includes(j.type)&&(!["kakao","instagram"].includes(j.channel)||(typeof j.text!=="string"&&(!Array.isArray(j.text)||!j.text.length||j.text.some(text=>typeof text!=="string"))))) || (j.type==="dialogue"&&(!["kakao","instagram"].includes(j.channel)||typeof j.nodeId!=="string")) || (["post-comment","fan-comment"].includes(j.type)&&(typeof j.postId!=="string"||typeof j.text!=="string")) || (j.type==="comment-like"&&(typeof j.postId!=="string"||typeof j.commentId!=="string")))) throw new Error("存檔的排程資料不完整");
  if(value.jobs.some(j=>j.photoReply!==undefined&&(j.type!=="incoming"||j.channel!=="instagram"||!["question","followUp"].includes(j.photoReply)||!Array.isArray(j.remaining)||j.remaining.some(text=>typeof text!=="string"||!text.trim()))))throw new Error("存檔的貼文私訊排程不完整");
  if(value.jobs.some(j=>j.afterPosts!==undefined&&(!["post-comment","fan-comment"].includes(j.type)||!Array.isArray(j.afterPosts)||!j.afterPosts.length||j.afterPosts.some(id=>!members.includes(id))||!Number.isFinite(j.delayAfterPosts)||j.delayAfterPosts<0)))throw new Error("存檔的留言順序資料不完整");
  if(Object.entries(value.events).some(([id,e])=>!members.includes(id) || !e || !["queued","asked","posted","done"].includes(e.phase) || typeof e.userShareId!=="string" || !["post","story"].includes(e.userShareType))) throw new Error("存檔的照片事件不完整");
  if(value.photoDetails&&members.some(id=>!value.photoDetails[id]||!Number.isInteger(value.photoDetails[id].daysAgo)||value.photoDetails[id].daysAgo<1||value.photoDetails[id].daysAgo>7||typeof value.photoDetails[id].description!=="string"))throw new Error("存檔的照片資訊不完整");
  if(value.dialogueSessions){
    for(const channel of ["kakao","instagram"]){
      const sessions=value.dialogueSessions[channel];
      if(!sessions||typeof sessions!=="object"||Array.isArray(sessions)||Object.entries(sessions).some(([id,s])=>!members.includes(id)||!s||(s.nodeId!==null&&typeof s.nodeId!=="string")||(s.pending!==null&&typeof s.pending!=="string")||typeof s.finished!=="boolean"))throw new Error("存檔的分支對話資料不完整");
    }
  }
  return upgradeState(value,config);
}
