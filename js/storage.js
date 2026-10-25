const KEY="itzy-phone-save-v1";
const RESET_KEY="itzy-phone-reset-v1";
let database;
let queue=Promise.resolve();
let storageEpoch=null,writeGeneration=0;
function readEpoch() {try{return localStorage.getItem(RESET_KEY);}catch{return null;}}
function currentSave(value) {return value&&(!storageEpoch||value.storageEpoch===storageEpoch)?value:null;}
function readFallback() {try{return currentSave(JSON.parse(localStorage.getItem(KEY)));}catch{return null;}}
function connectDatabase() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open("itzy-phone",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("saves");
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function writeDatabase(snapshot) {
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction("saves","readwrite");
    transaction.objectStore("saves").put(snapshot,KEY);
    transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });
}
export async function openStorage() {
  storageEpoch=readEpoch();
  try {
    database=await connectDatabase();
    const value=await new Promise((resolve,reject)=>{
      const request=database.transaction("saves").objectStore("saves").get(KEY);
      request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);
    });
    return currentSave(value)||readFallback();
  } catch {database=null;return readFallback();}
}
export function saveState(state) {
  const snapshot={...structuredClone(state),storageEpoch},generation=writeGeneration;
  const action=queue.catch(()=>{}).then(()=>{
    // A queued save or another tab from before the reset must not restore old progress.
    const epoch=readEpoch();
    if(generation!==writeGeneration||(epoch&&epoch!==storageEpoch))return;
    if(!database){localStorage.setItem(KEY,JSON.stringify(snapshot));return;}
    return writeDatabase(snapshot);
  });
  queue=action;return action;
}
export function resetStorage(state) {
  const previousEpoch=storageEpoch;
  const epoch=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
  const snapshot={...structuredClone(state),storageEpoch:epoch};
  ++writeGeneration;storageEpoch=epoch;
  let fallbackSaved=false;
  try {
    // The marker also rejects an old IndexedDB save if that backend is temporarily unavailable.
    localStorage.setItem(RESET_KEY,epoch);
    localStorage.setItem(KEY,JSON.stringify(snapshot));
    fallbackSaved=true;
  }catch{}
  const action=queue.catch(()=>{}).then(async()=>{
    try {
      database??=await connectDatabase();
      await writeDatabase(snapshot);
    }catch(error){
      database=null;
      if(!fallbackSaved){
        storageEpoch=previousEpoch;
        try{if(readEpoch()===epoch){if(previousEpoch)localStorage.setItem(RESET_KEY,previousEpoch);else localStorage.removeItem(RESET_KEY);}}catch{}
        throw error;
      }
    }
  });
  queue=action;return action;
}
