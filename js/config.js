/* 劇本編輯區：直接修改本檔即可。所有人物互動皆為同人虛構。
 * 初始訊息只套用於新存檔；修改後可到「遊戲設定 → 重新開始」。
 * keywordRules 預留空白，不會自行產生 AI 回覆。設定範例見 README。
 */
window.PHONE_CONFIG = {
  player: { name: "김서연", username: "seoyeon.zip", bio: "서울의 작은 일상 ☁️\n和喜歡的人，收集一些日常。", avatar: "assets/avatar-me.svg" },
  wallpapers: { lock: "photo/lockscreen.jpg", home: "photo/homescreen.jpg" },
  members: [
    { id: "yeji", name: "Yeji", displayName: "YEJI", korean: "예지", username: "yezyizhere", color: "#d9c3b5", emoji: "🐈", observer: "ryujin" },
    { id: "lia", name: "Lia", displayName: "LIA", korean: "리아", username: "lia_loves___", color: "#d8c3d9", emoji: "🤍", observer: "yuna" },
    { id: "ryujin", name: "Ryujin", displayName: "RYUJIN", korean: "류진", username: "iamfinethankyouandryu", color: "#bdcdd1", emoji: "🐱", observer: "chaeryeong" },
    { id: "chaeryeong", name: "Chaeryeong", displayName: "CHAERYEONG", korean: "채령", username: "chaerrry0", color: "#cbd4bd", emoji: "🦊", observer: "lia" },
    { id: "yuna", name: "Yuna", displayName: "YUNA", korean: "유나", username: "igotyuandme", color: "#e5c3c7", emoji: "🐰", observer: "yeji" }
  ],
  assets: {
    instagramAvatar: id => `photo/ins/profile/${id}.jpg`,
    phoneAvatar: id => `photo/ins/profile/${id}.jpg`, // 目前沿用現有頭貼；可改為 photo/phone/ 下的個別照片
    pairedPhoto: (id, side) => `photo/ins/${id}/${side}.jpg`
  },
  weather: {
    date: "2026-10-24", city: "首爾", temperature: 19, condition: "多雲", high: 19, low: 12,
    note: "傍晚漸涼，出門記得帶件外套。",
    hours: [ {time:"15時",temp:19}, {time:"16時",temp:18}, {time:"17時",temp:18}, {time:"18時",temp:17}, {time:"19時",temp:16} ],
    source: "https://www.timeanddate.com/weather/south-korea/seoul/ext",
    sourceLabel: "Time and Date / CustomWeather；小時資料：建立時天氣查詢",
    checkedAt: "2026-10-24（首爾時間）"
  },
  // 以下為可自由替換的開場示範，不是成員的真實訊息。
  initialMessages: {
    kakao: {
      yeji: ["今天也要記得吃飯 🤍"], lia: ["下次一起去上次說的那間咖啡廳？"],
      ryujin: ["你在幹嘛？"], chaeryeong: ["回家了嗎？外面有點涼。"], yuna: ["看到好看的天空就想到你 ☁️"]
    },
    instagram: { yeji: [], lia: [], ryujin: [], chaeryeong: [], yuna: [] }
  },
  // 可設定成員在開啟遊戲後主動傳來的訊息。空陣列表示沒有。
  // { id:"hello-1", channel:"kakao", member:"yeji", delay:5000, text:"你今天有空嗎？" }
  incomingMessages: [],
  keywordRules: { kakao: [], instagram: [] },
  // 範例：{ id:"dinner", member:"yeji", keywords:["吃飯","晚餐"], replies:["想吃什麼？"], delay:1200, once:true }
  photoEvents: {
    dmDelay: 1200, postDelay: 3500, observerDelay: 2200,
    scripts: {
      yeji: { question:"怎麼突然把這張放上來了？那天的照片你還留著喔 🤍", caption:"那就放一張，同一天的。☁️", observer:"等一下，你跟 Yeji 發的照片……是同一天拍的吧？" },
      lia: { question:"你上傳了那天的照片？為什麼突然想到這張 ☺️", caption:"a little memory with you 🤍", observer:"你跟 Lia 姐姐的貼文怎麼有點像？你們一起出去的？" },
      ryujin: { question:"這張你居然還留著。怎麼突然發了？", caption:"same day, different view.", observer:"我是不是發現了什麼？你跟 Ryujin 的照片好像對得起來耶。" },
      chaeryeong: { question:"是我們那天拍的……你怎麼選了這張？", caption:"想把那天再留久一點。🌿", observer:"你跟 Chaeryeong 是不是有事情沒跟我說？我看到照片了喔。" },
      yuna: { question:"欸！這張！你怎麼突然發上來了 🥺", caption:"my favorite kind of day 🎀", observer:"你跟 Yuna 今天的貼文……怎麼看起來是在一起？" }
    }
  },
  seedStories: true,
  sms: [
    { id:"delivery", name:"CJ 大韓通運", time:"10:12", messages:["[配送通知] 您的包裹已送達，放置於家門口。訂單尾碼 0423。", "如有配送問題，請透過購物平台聯絡客服。"] },
    { id:"bank", name:"新韓銀行", time:"昨天", messages:["[刷卡通知] 10/23 14:28，咖啡廳消費 5,500 韓元。", "本訊息為遊戲示範，不含真實帳務資料。"] },
    { id:"carrier", name:"SK Telecom", time:"星期四", messages:["[用量提醒] 本月行動數據已使用 80%。連上 Wi-Fi 後可繼續使用網路服務。"] },
    { id:"verification", name:"驗證碼", time:"星期三", messages:["[登入驗證] 您的驗證碼是 482619。請勿將驗證碼提供給任何人。（遊戲範例）"] }
  ]
};
