const KEY="itzy-phone-save-v1";
let database;
let queue=Promise.resolve();
export async function openStorage() {
  try {
    database=await new Promise((resolve,reject)=>{
      const request=indexedDB.open("itzy-phone",1);
      request.onupgradeneeded=()=>request.result.createObjectStore("saves");
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    return await new Promise((resolve,reject)=>{
      const request=database.transaction("saves").objectStore("saves").get(KEY);
      request.onsuccess=()=>resolve(request.result ?? null); request.onerror=()=>reject(request.error);
    });
  } catch { database=null; try {return JSON.parse(localStorage.getItem(KEY));} catch{return null;} }
}
export function saveState(state) {
  const snapshot=structuredClone(state);
  const action=queue.catch(()=>{}).then(()=>{
    if (!database) {localStorage.setItem(KEY,JSON.stringify(snapshot));return;}
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction("saves","readwrite");
      transaction.objectStore("saves").put(snapshot,KEY);
      transaction.oncomplete=resolve; transaction.onerror=()=>reject(transaction.error); transaction.onabort=()=>reject(transaction.error);
    });
  });
  queue=action; return action;
}
