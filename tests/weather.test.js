import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeatherClient,parseSeoulWeather,seoulDay,weatherCondition} from '../js/weather.js';
const start=Date.parse('2026-10-29T14:30:00Z');
function forecast(now=start){
  const day=seoulDay(now),midnight=Date.parse(`${day}T00:00:00+09:00`);
  const times=Array.from({length:48},(_,i)=>new Date(midnight+i*3600000+9*3600000).toISOString().slice(0,16));
  return {timezone:'Asia/Seoul',current:{time:new Date(now+9*3600000).toISOString().slice(0,16),temperature_2m:12.4,weather_code:61,is_day:0},daily:{time:[day,times[24].slice(0,10)],temperature_2m_max:[17.2,18],temperature_2m_min:[3.6,5]},hourly:{time:times,temperature_2m:times.map((_,i)=>10+i/10),weather_code:times.map(()=>3)}};
}
function memory(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),values};}
const response=payload=>({ok:true,json:async()=>payload});

test('Seoul forecast dates ignore player timezone and hourly forecasts cross midnight correctly',()=>{
  const previous=process.env.TZ;
  try{
    process.env.TZ='Pacific/Honolulu';assert.equal(seoulDay(Date.parse('2026-10-29T15:01:00Z')),'2026-10-30');
    process.env.TZ='America/Chicago';assert.equal(seoulDay(Date.parse('2026-10-29T15:01:00Z')),'2026-10-30');
    const value=parseSeoulWeather(forecast(),start);
    assert.equal(value.temperature,12);assert.equal(value.high,17);assert.equal(value.low,4);assert.equal(value.condition,'下雨');
    assert.deepEqual(value.hours.map(h=>h.time),['23時','0時','1時','2時','3時']);
    assert.equal(weatherCondition(0,false).icon,'moon');assert.equal(weatherCondition(0,true).icon,'sun');
    assert.equal(weatherCondition(75).condition,'下雪');assert.equal(weatherCondition(95).condition,'雷雨');assert.equal(weatherCondition(45).condition,'有霧');
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('invalid or yesterday weather cannot be presented as today forecast',()=>{
  for(const change of [p=>p.current.temperature_2m=null,p=>p.timezone='UTC',p=>p.current.time='2026-10-28T23:30',p=>p.daily.temperature_2m_max=[null],p=>p.hourly.time=[],p=>p.hourly.weather_code=[]]){
    const payload=forecast();change(payload);assert.throws(()=>parseSeoulWeather(payload,start));
  }
});

test('weather client requests fixed Seoul coordinates once and caches data for thirty minutes',async()=>{
  let time=start,calls=0,resolve;
  const storage=memory();
  const client=createWeatherClient({}, {storage,now:()=>time,fetcher:(url,options)=>{
    calls++;const parsed=new URL(url);assert.equal(parsed.hostname,'api.open-meteo.com');assert.equal(parsed.searchParams.get('timezone'),'Asia/Seoul');
    assert.equal(parsed.searchParams.get('latitude'),'37.5665');assert.equal(parsed.searchParams.get('longitude'),'126.978');assert.equal(parsed.searchParams.get('forecast_days'),'2');
    assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');
    return new Promise(done=>resolve=done);
  }});
  const first=client.refresh();assert.equal(client.refresh(),first);assert.equal(calls,1);assert.equal(client.status,'loading');
  resolve(response(forecast(time)));assert.equal(await first,true);assert.equal(client.status,'ready');assert.equal(client.data.date,'2026-10-29');
  time+=60000;assert.equal(await client.refresh(),false);assert.equal(calls,1);assert.equal(storage.values.size,1);
  const restored=createWeatherClient({}, {storage,now:()=>time,fetcher:()=>{throw new Error('should use cache');}});
  assert.equal(restored.data.temperature,12);assert.equal(await restored.refresh(),false);
  // 跨首爾午夜，即使三十分鐘尚未到也必須重新取得當日資料。
  time=Date.parse('2026-10-29T15:00:00Z');assert.equal(client.data,null);
  const next=client.refresh();assert.equal(calls,2);resolve(response(forecast(time)));assert.equal(await next,true);assert.equal(client.data.date,'2026-10-30');
});

test('failed refresh retains same-day cache, throttles retries and recovers',async()=>{
  let time=start-12*3600000,calls=0,offline=false;
  const client=createWeatherClient({}, {storage:memory(),now:()=>time,fetcher:async()=>{calls++;if(offline)throw new Error('offline');return response(forecast(time));}});
  await client.refresh();time+=1800001;offline=true;
  assert.equal(await client.refresh(),false);assert.equal(client.status,'error');assert.equal(client.data.temperature,12);
  assert.equal(await client.refresh(),false);assert.equal(calls,2);
  time+=300001;offline=false;assert.equal(await client.refresh(),true);assert.equal(calls,3);assert.equal(client.status,'ready');
});

test('unavailable storage, corrupt cache and HTTP errors do not prevent use of the game',async()=>{
  const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  let ok=false;
  const client=createWeatherClient({}, {storage,now:()=>start,fetcher:async()=>ok?response(forecast()):{ok:false}});
  assert.equal(client.data,null);assert.equal(await client.refresh(),false);assert.equal(client.status,'error');
  ok=true;assert.equal(await client.refresh({force:true}),true);assert.equal(client.data.temperature,12);
  const corrupt=memory();corrupt.setItem('itzy-phone-seoul-weather-v1','broken JSON');
  const clean=createWeatherClient({}, {storage:corrupt,now:()=>start,fetcher:async()=>response(forecast())});assert.equal(clean.data,null);assert.equal(await clean.refresh(),true);
});
