// 純資料與劇情狀態機；不依賴畫面，可直接用 node --test 驗證。
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function createState(config, now = Date.now()) {
  const chats = { kakao: {}, instagram: {} };
  for (const channel of Object.keys(chats)) for (const member of config.members) {
    chats[channel][member.id] = (config.initialMessages[channel]?.[member.id] || []).map((text, i) => ({ id:uid(),sender:member.id,text,time:now - (5-i)*60000,read:false,kind:"text" }));
  }
  return {
    version:1, profile:{...config.player}, chats, posts:[],
    stories:config.seedStories ? config.members.map((m,i)=>({id:uid(),author:m.id,src:`assets/moment-${m.id}.svg`,createdAt:now-i*180000,seen:false,demo:true})) : [],
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
  return value;
}
