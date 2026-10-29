// 首爾天氣獨立於遊戲存檔；只傳固定城市座標，不要求玩家定位。
export const WEATHER_SOURCE='https://open-meteo.com/';
const WEATHER_CACHE_KEY='itzy-phone-seoul-weather-v1';
const SEOUL_TIMEZONE='Asia/Seoul';
function seoulParts(now){
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:SEOUL_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(part=>[part.type,part.value]));
}
export function seoulDay(now=Date.now()){
  const p=seoulParts(now);return `${p.year}-${p.month}-${p.day}`;
}
export function weatherCondition(code,isDay=true){
  if(code===0)return {condition:'晴朗',icon:isDay?'sun':'moon'};
  if(code===1||code===2)return {condition:'晴時多雲',icon:isDay?'sunCloud':'cloud'};
  if(code===3)return {condition:'多雲',icon:'cloud'};
  if(code===45||code===48)return {condition:'有霧',icon:'fog'};
  if([51,53,55].includes(code))return {condition:'毛毛雨',icon:'rain'};
  if([56,57].includes(code))return {condition:'凍毛毛雨',icon:'rain'};
  if([61,63,65].includes(code))return {condition:'下雨',icon:'rain'};
  if(code===66||code===67)return {condition:'凍雨',icon:'rain'};
  if([71,73,75,77].includes(code))return {condition:'下雪',icon:'snow'};
  if([80,81,82].includes(code))return {condition:'陣雨',icon:'rain'};
  if(code===85||code===86)return {condition:'陣雪',icon:'snow'};
  if(code===95)return {condition:'雷雨',icon:'storm'};
  if(code===96||code===99)return {condition:'雷雨伴冰雹',icon:'storm'};
  return {condition:'天氣資料',icon:'cloud'};
}
export function parseSeoulWeather(payload,now=Date.now()){
  const current=payload?.current,daily=payload?.daily,hourly=payload?.hourly;
  const date=seoulDay(now),dayIndex=daily?.time?.indexOf(date)??-1;
  if(payload?.timezone!==SEOUL_TIMEZONE||typeof current?.time!=='string'||current.time.slice(0,10)!==date||!Number.isFinite(current.temperature_2m)||!Number.isInteger(current.weather_code)||dayIndex<0||!Number.isFinite(daily.temperature_2m_max?.[dayIndex])||!Number.isFinite(daily.temperature_2m_min?.[dayIndex]))throw new Error('無法取得今天的首爾天氣');
  if(!Array.isArray(hourly?.time)||!Array.isArray(hourly.temperature_2m)||!Array.isArray(hourly.weather_code)||hourly.time.length!==hourly.temperature_2m.length||hourly.time.length!==hourly.weather_code.length)throw new Error('逐時預報資料不完整');
  const firstHour=`${date}T${seoulParts(now).hour}:00`;
  const hours=hourly.time.flatMap((time,index)=>{
    if(typeof time!=='string'||time<firstHour||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)||!Number.isFinite(hourly.temperature_2m[index])||!Number.isInteger(hourly.weather_code[index]))return [];
    return [{time:`${Number(time.slice(11,13))}時`,temp:Math.round(hourly.temperature_2m[index]),...weatherCondition(hourly.weather_code[index])}];
  }).slice(0,5);
  if(hours.length<5)throw new Error('逐時預報資料不足');
  return {date,temperature:Math.round(current.temperature_2m),high:Math.round(daily.temperature_2m_max[dayIndex]),low:Math.round(daily.temperature_2m_min[dayIndex]),...weatherCondition(current.weather_code,current.is_day!==0),hours};
}
export function createWeatherClient(settings={},options={}){
  const fetcher=options.fetcher??globalThis.fetch,now=options.now??Date.now,onUpdate=options.onUpdate??(()=>{});
  let storage=options.storage;
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  const refreshMs=settings.refreshMs??1800000,retryMs=settings.retryMs??300000;
  let cached=null,status='idle',inFlight=null,lastAttempt=null,lastAttemptDay=null;
  try{const value=JSON.parse(storage?.getItem(WEATHER_CACHE_KEY)||'null');if(Number.isFinite(value?.fetchedAt)&&value.fetchedAt<=now()){parseSeoulWeather(value.payload,now());cached=value;status='ready';}}catch{}
  function data(){try{return cached?parseSeoulWeather(cached.payload,now()):null;}catch{return null;}}
  function refresh({force=false}={}){
    if(inFlight)return inFlight;
    const today=seoulDay(now()),elapsed=cached?now()-cached.fetchedAt:Infinity;
    if(!force&&data()&&elapsed>=0&&elapsed<refreshMs)return Promise.resolve(false);
    if(!force&&lastAttempt!==null&&lastAttemptDay===today&&now()-lastAttempt>=0&&now()-lastAttempt<retryMs)return Promise.resolve(false);
    lastAttempt=now();lastAttemptDay=today;status='loading';onUpdate();
    inFlight=(async()=>{
      let timer;
      try{
        if(typeof fetcher!=='function')throw new Error('無網路連線');
        const controller=new AbortController();timer=setTimeout(()=>controller.abort(),10000);
        const url=new URL('https://api.open-meteo.com/v1/forecast');
        for(const [key,value] of Object.entries({latitude:settings.latitude??37.5665,longitude:settings.longitude??126.978,timezone:SEOUL_TIMEZONE,current:'temperature_2m,weather_code,is_day',hourly:'temperature_2m,weather_code',daily:'temperature_2m_max,temperature_2m_min',forecast_days:2}))url.searchParams.set(key,value);
        const response=await fetcher(url.href,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
        if(!response.ok)throw new Error('天氣服務暫時無法連線');
        const payload=await response.json();parseSeoulWeather(payload,now());
        cached={fetchedAt:now(),payload};status='ready';
        try{storage?.setItem(WEATHER_CACHE_KEY,JSON.stringify(cached));}catch{}
        return true;
      }catch{status='error';return false;}
      finally{clearTimeout(timer);onUpdate();}
    })();
    const pending=inFlight;
    // 另行清除鎖，包含 fetch 不可用時同步失敗的情況。
    pending.then(()=>{if(inFlight===pending)inFlight=null;});
    return pending;
  }
  return {get data(){return data();},get status(){return status;},get updatedAt(){return cached?.fetchedAt??null;},refresh};
}
