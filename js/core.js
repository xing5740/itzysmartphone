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
  return String(text??"").replaceAll("{{nickname}}",state.profile.nickname||state.profile.name).replaceAll("{{name}}",state.profile.name);
}
export function completeOnboarding(state, username, nickname, now=Date.now()) {
  const handle=String(username).trim().replace(/^@/,""),name=String(nickname).trim();
  if(!/^[A-Za-z0-9_.]{1,30}$/.test(handle))throw new Error("Instagram ID 請使用 1–30 個英文字母、數字、底線或句點。");
  if(!name||name.length>40)throw new Error("稱呼請填寫 1–40 個字。");
  state.profile.username=handle;state.profile.nickname=name;state.profile.name=name;
  if(!state.onboardingComplete){const paused=Math.max(0,now-(state.setupStartedAt??now));state.jobs.forEach(j=>j.dueAt+=paused);}
  state.onboardingComplete=true;state.setupStartedAt=null;
}
function upgradeState(state, config) {
  if(typeof state.profile.nickname!=="string")state.profile.nickname=state.profile.name;
  if(typeof state.onboardingComplete!=="boolean"){state.onboardingComplete=false;state.setupStartedAt=Date.now();}
  if(!state.photoDetails)state.photoDetails=createPhotoDetails(config);
  if(state.profile.bio==="서울의 작은 일상 ☁️\n和喜歡的人，收集一些日常。")state.profile.bio="";
  for(const story of state.stories)if(story.demo&&story.author!=="me")story.src=config.assets.pairedPhoto(story.author,"her");
  return state;
}
export function createState(config, now = Date.now()) {
  const chats = { kakao: {}, instagram: {} };
  for (const channel of Object.keys(chats)) for (const member of config.members) {
    chats[channel][member.id] = (config.initialMessages[channel]?.[member.id] || []).map((text, i) => ({ id:uid(),sender:member.id,text,time:now - (5-i)*60000,read:false,kind:"text" }));
  }
  return {
    version:1, profile:{...config.player,nickname:config.player.nickname||""}, onboardingComplete:false,setupStartedAt:now,photoDetails:createPhotoDetails(config),chats,posts:[],
    stories:config.seedStories ? config.members.map((m,i)=>({id:uid(),author:m.id,src:config.assets.pairedPhoto(m.id,"her"),createdAt:now-i*180000,seen:false,demo:true})) : [],
    events:{}, jobs:(config.incomingMessages || []).map(x=>({...x,type:"incoming",dueAt:now+x.delay})), usedRules:[], bookmarked:[]
  };
}
export function addMessage(state, channel, member, text, sender=member, now=Date.now(), extra={}) {
  if (!state.chats[channel]?.[member]) throw new Error("無效的聊天室");
  const message = {id:uid(),sender,text,time:now,read:sender==="me",kind:"text",...extra};
  state.chats[channel][member].push(message);
  return message;
}
export function queueKeywordReplies(state, config, channel, member, text, now=Date.now()) {
  for (const rule of config.keywordRules[channel] || []) {
    if (rule.member!==member || !(rule.keywords || []).some(k=>text.toLocaleLowerCase().includes(k.toLocaleLowerCase()))) continue;
    const key = `${channel}:${rule.id}`;
    if (rule.once && state.usedRules.includes(key)) continue;
    state.usedRules.push(key);
    (rule.replies || []).forEach((reply,i)=>state.jobs.push({id:uid(),type:"incoming",channel,member,text:reply,dueAt:now+(rule.delay??1200)*(i+1)}));
  }
}
export function publish(state, config, {type="post", images, caption=""}, now=Date.now()) {
  if (!images?.length) throw new Error("請先選擇照片");
  const item = type==="story"
    ? {id:uid(),author:"me",src:images[0].src,createdAt:now,seen:false}
    : {id:uid(),author:"me",images:images.map(x=>({...x})),caption,time:now,likes:0,liked:false,comments:[],slide:0};
  if (type==="story") state.stories.push(item); else state.posts.unshift(item);
  const selected = type==="story" ? images.slice(0,1) : images;
  for (const image of selected) {
    const member = config.members.find(m=>m.id===image.member);
    if (image.side!=="me" || !member || state.events[member.id]) continue;
    state.events[member.id]={phase:"queued",userShareId:item.id,userShareType:type};
    state.jobs.push({id:uid(),type:"photo-dm",member:member.id,dueAt:now+config.photoEvents.dmDelay});
  }
  return item;
}
export function runDueJobs(state, config, now=Date.now()) {
  const notices = [];
  const due=state.jobs.filter(j=>j.dueAt<=now).sort((a,b)=>a.dueAt-b.dueAt);
  for (const job of due) {
    state.jobs=state.jobs.filter(j=>j.id!==job.id);
    const m=config.members.find(x=>x.id===job.member);
    if (!m) continue;
    const script=config.photoEvents.scripts[m.id];
    if (job.type==="incoming") {
      if (!state.chats[job.channel]?.[job.member] || !job.text) continue;
      addMessage(state,job.channel,m.id,job.text,m.id,now);
      notices.push({channel:job.channel,member:m.id,text:job.text});
    } else if (job.type==="photo-dm" && state.events[m.id]?.phase==="queued") {
      addMessage(state,"instagram",m.id,script.question,m.id,now);
      state.events[m.id].phase="asked";
      state.jobs.push({id:uid(),type:"photo-post",member:m.id,dueAt:now+config.photoEvents.postDelay});
      notices.push({channel:"instagram",member:m.id,text:script.question});
    } else if (job.type==="photo-post" && state.events[m.id]?.phase==="asked") {
      const post={id:uid(),author:m.id,images:[{src:config.assets.pairedPhoto(m.id,"her"),member:m.id,side:"her"}],caption:script.caption,time:now,likes:0,liked:false,comments:[],slide:0};
      state.posts.unshift(post);
      state.events[m.id].phase="posted";
      state.events[m.id].counterpartId=post.id;
      state.jobs.push({id:uid(),type:"photo-observer",member:m.id,dueAt:now+config.photoEvents.observerDelay});
      notices.push({postId:post.id,member:m.id,text:`${m.name} 發佈了一則新貼文`});
    } else if (job.type==="photo-observer" && state.events[m.id]?.phase==="posted") {
      const event=state.events[m.id];
      const userExists=event.userShareType==="story" ? state.stories.some(s=>s.id===event.userShareId) : state.posts.some(p=>p.id===event.userShareId);
      if (userExists && state.posts.some(p=>p.id===event.counterpartId)) {
        addMessage(state,"instagram",m.observer,script.observer,m.observer,now);
        notices.push({channel:"instagram",member:m.observer,text:script.observer});
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
  const members=config.members.map(m=>m.id),authors=["me",...members];
  if (!value || value.version!==1 || !value.profile || typeof value.profile.name!=="string" || typeof value.profile.username!=="string" || typeof value.profile.bio!=="string" || typeof value.profile.avatar!=="string" || !Array.isArray(value.posts) || !Array.isArray(value.stories) || !Array.isArray(value.jobs) || !Array.isArray(value.usedRules) || !Array.isArray(value.bookmarked) || !value.events || Array.isArray(value.events) || !value.chats) throw new Error("這不是有效的 itzy phone 存檔");
  for (const channel of ["kakao","instagram"]) for (const m of config.members) {
    if (!Array.isArray(value.chats[channel]?.[m.id]) || value.chats[channel][m.id].some(x=>!x || typeof x.text!=="string" || !Number.isFinite(x.time) || !["me",m.id].includes(x.sender) || !["text","post"].includes(x.kind) || (x.kind==="post"&&typeof x.postId!=="string"))) throw new Error("存檔的聊天資料不完整");
  }
  if(value.posts.some(p=>!p || typeof p.id!=="string" || !authors.includes(p.author) || !Number.isFinite(p.time) || !Number.isFinite(p.likes) || !Array.isArray(p.images) || !p.images.length || p.images.length>10 || !Array.isArray(p.comments) || typeof p.caption!=="string" || p.images.some(i=>!i || typeof i.src!=="string") || p.comments.some(c=>!c || !authors.includes(c.author) || typeof c.text!=="string" || !Number.isFinite(c.time)))) throw new Error("存檔的貼文資料不完整");
  if(value.stories.some(s=>!s || typeof s.id!=="string" || !authors.includes(s.author) || typeof s.src!=="string" || !Number.isFinite(s.createdAt))) throw new Error("存檔的限時動態資料不完整");
  if(value.jobs.some(j=>!j || typeof j.id!=="string" || !members.includes(j.member) || !Number.isFinite(j.dueAt) || !["incoming","photo-dm","photo-post","photo-observer"].includes(j.type) || (j.type==="incoming"&&(!["kakao","instagram"].includes(j.channel)||typeof j.text!=="string")))) throw new Error("存檔的排程資料不完整");
  if(Object.entries(value.events).some(([id,e])=>!members.includes(id) || !e || !["queued","asked","posted","done"].includes(e.phase) || typeof e.userShareId!=="string" || !["post","story"].includes(e.userShareType))) throw new Error("存檔的照片事件不完整");
  if(value.photoDetails&&members.some(id=>!value.photoDetails[id]||!Number.isInteger(value.photoDetails[id].daysAgo)||value.photoDetails[id].daysAgo<1||value.photoDetails[id].daysAgo>7||typeof value.photoDetails[id].description!=="string"))throw new Error("存檔的照片資訊不完整");
  return upgradeState(value,config);
}
