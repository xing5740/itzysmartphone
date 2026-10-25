/*
 * ITZY 手機設定與劇本（人物互動皆為同人虛構）
 *
 * 編輯方式：直接修改下方設定，欄位範例與完整說明見 README.md。
 * - 玩家預設資料、開場訊息與開局排程主要用於新存檔；測試時可用「設定 → 重新開始」。
 * - 玩家已修改的資料以瀏覽器存檔為準；已完成的對話與配圖事件不會因修改本檔而重播。
 * - 時間欄位 delay、spacing、refreshMs 等皆以毫秒計算：1000 = 1 秒。
 * - 互動文字可用 {{nickname}} 代入玩家稱呼、{{name}} 代入玩家顯示名稱。
 * - 粉絲誇誇台詞另以 {{member}} 代入照片中的成員名稱。
 */
window.PHONE_CONFIG = {
  // 1. 玩家與照片：玩家可在開局設定帳號、稱呼，之後也能在設定中修改。
  player: { name: "믿지", nickname: "midzy", username: "midzyloveitzy", bio: "", avatar: "assets/avatar-me.svg" },
  // 相簿照片的預設說明；玩家自行編輯後以存檔為準，分享單張照片時會帶入發文說明。
  photoDescriptions: {
    yeji:"Yeji 傳來的自拍照",
    lia:"和 Lia 一起去吃飯的時候拍的",
    ryujin:"和 Ryujin 一起去逛街的時候拍的",
    chaeryeong:"和 Chaeryeong 一起出去玩的時候拍的",
    yuna:"Yuna 傳來的自拍照"
  },
  // 鎖定畫面與主畫面的桌布路徑。
  wallpapers: { lock: "photo/lockscreen.jpg", home: "photo/homescreen.jpg" },

  // 2. 成員資料與圖片路徑（依年齡由大到小排列，作為歡迎訊息與同時間聊天的排序）。
  // id 是聊天室、劇本與照片的共用識別碼；username 是 Instagram 帳號。
  // name / displayName / korean 分別為一般顯示名稱、Instagram 名稱、韓文名稱。
  members: [
    { id: "yeji", name: "Yeji", displayName: "YEJI", korean: "예지", username: "yezyizhere", color: "#d9c3b5", emoji: "🐈" },
    { id: "lia", name: "Lia", displayName: "LIA", korean: "리아", username: "lia_loves___", color: "#d8c3d9", emoji: "🤍" },
    { id: "ryujin", name: "Ryujin", displayName: "RYUJIN", korean: "류진", username: "iamfinethankyouandryu", color: "#bdcdd1", emoji: "🐱" },
    { id: "chaeryeong", name: "Chaeryeong", displayName: "CHAERYEONG", korean: "채령", username: "chaerrry0", color: "#cbd4bd", emoji: "🦊" },
    { id: "yuna", name: "Yuna", displayName: "YUNA", korean: "유나", username: "igotyuandme", color: "#e5c3c7", emoji: "🐰" }
  ],
  // pairedPhoto 的 side：me 是玩家上傳的照片，her 是成員接著發佈的對應照片。
  assets: {
    kakaoAvatar: id => `photo/kkt/profile/${id}_kkt.jpg`,
    instagramAvatar: id => `photo/ins/profile/${id}.jpg`,
    phoneAvatar: id => `photo/ins/profile/${id}.jpg`, // 電話聯絡人目前共用 Instagram 頭貼，可自行換成其他路徑。
    pairedPhoto: (id, side) => `photo/ins/${id}/${side}.jpg`
  },

  // 3. 首爾天氣：固定保存的預報快照，不會每天更新。
  // date / checkedAt / source 用於標示資料日期與來源；手機時鐘另依瀏覽器時間顯示。
  weather: {
    date: "2026-10-24", city: "首爾", temperature: 19, condition: "多雲", high: 19, low: 12,
    note: "傍晚漸涼，出門記得帶件外套。",
    hours: [ {time:"15時",temp:19}, {time:"16時",temp:18}, {time:"17時",temp:18}, {time:"18時",temp:17}, {time:"19時",temp:16} ],
    source: "https://www.timeanddate.com/weather/south-korea/seoul/ext",
    sourceLabel: "Time and Date / CustomWeather；小時資料：建立時天氣查詢",
    checkedAt: "2026-10-24（首爾時間）"
  },

  // 4. 開場訊息：每位成員的陣列依序放入聊天室，只在建立新存檔時套用。
  // KKT 歡迎訊息的回覆選項設在下方 dialogues → 成員 → nodes.welcome。
  // 聊天台詞中的句號會自動拆成多則訊息，不顯示句號；問號、驚嘆號及 emoji 保留。
  // Instagram 目前沒有開場訊息，私訊由照片劇情觸發。
  initialMessages: {
    kakao: {
      yeji: ["{{nickname}}，今天也要記得吃飯 🖤"], lia: ["下次一起去上次說的那間咖啡廳？"],
      ryujin: ["{{nickname}}，你在幹嘛？"], chaeryeong: ["回家了嗎？外面有點涼。"], yuna: ["看到好看的天空就想到你"]
    },
    instagram: { yeji: [], lia: [], ryujin: [], chaeryeong: [], yuna: [] }
  },

  // 5. KKT 快速 emoji：value 是傳送按鈕旁的 emoji，也可手動輸入後送出。
  // replies 依成員分組；外層陣列是隨機選一組，內層陣列是該組依序傳送的訊息。
  // delay 是每則回覆的間隔；此互動不推進下方的選項式對話。
  kakaoEmoji: {
    value:"❤️",delay:900,
    replies:{
      yeji:[
        ["❤️","這顆愛心我收下了"],
        ["突然傳這個，是在想我嗎？","那我也回你一顆 🖤"],
        ["這顆我先收好。","你本人什麼時候出現？"]
      ],
      lia:[
        ["收到你的愛心了☺️","今天有發生什麼開心的事嗎？"],
        ["在撒嬌嗎？","好啦，我有看到。再陪我聊一下？"],
        ["❤️","今天也要好好吃飯，吃飽了再來找我"]
      ],
      ryujin:[
        ["只有愛心？","本人呢？"],
        ["❤️","好了，現在換你說想我"],
        ["突然這麼可愛","我剛剛差點對著手機笑出來"]
      ],
      chaeryeong:[
        ["突然這樣……","害我盯著手機笑了好久"],
        ["收到啦，{{nickname}}。","我也想你❤️"],
        ["你是不是有事情想跟我說？","我會一直聽你講的"]
      ],
      yuna:[
        ["只有一顆嗎？","❤️❤️❤️", "我要給你三顆"],
        ["{{nickname}}你是不是想我了！","我剛剛也正想傳訊息給你"],
        ["這顆愛心我截圖了","下次見面的時候，也要對我比一次愛心"]
      ]
    }
  },

  // 6. 選項式對話：目前只在 KKT 啟用，Instagram 使用下方照片劇情。
  // start 指定歡迎節點，randomStart 指定隨機日常對話的起點；next 必須對應到已有節點。
  // welcome.initial: true 沿用原有歡迎訊息，直接顯示一個選項，不再傳送一次開場文字。
  // message 是成員台詞；choices[].text 是玩家點選後送出的文字。
  // choices[].next 指定下一個節點，choices[].delay 可調整回覆延遲（預設 900 毫秒）。
  // 沒有 choices 的節點代表對話結束；選項 id 在同一節點內不可重複。
  dialogueChannels: ["kakao"],
  // 每位成員各自完成歡迎對話，才可被抽中開啟日常對話；不需等待其他成員。
  // 歡迎流程：成員開場 → 玩家選一個回覆 → 成員 response 回應後結束。
  // responseDelay 可設定最後回應的等待時間，預設 1200 毫秒；收到後才解鎖該成員。
  // 同時只進行一位成員的日常對話，結束後再等待 45～120 秒；同一段對話不重複觸發。
  randomDialogues:{enabled:true,delay:[45000,120000]},
  dialogues: {
    yeji: {
      start:"welcome",randomStart:"invite",
      nodes:{
        welcome:{initial:true,response:"那就好，別又忙到忘記吃飯 🖤",choices:[{id:"reply",text:"我有好好吃飯，你也是 🖤"}]},
        invite:{message:"{{nickname}}，今天有空嗎？想找你一起出去。",choices:[
          {id:"coffee",text:"一起去喝咖啡？",next:"coffee"},
          {id:"later",text:"今天有點忙，改天好嗎？",next:"later"}
        ]},
        coffee:{message:"好啊！你想下午去，還是晚上？",choices:[
          {id:"afternoon",text:"下午吧，我想坐窗邊。",next:"afternoon"},
          {id:"evening",text:"晚上見，吃完飯再去。",next:"evening"}
        ]},
        afternoon:{message:"那就下午，我先去找間有窗邊座位的店🖤"},
        evening:{message:"好，晚上見。到時候傳訊息給我。"},
        later:{message:"沒關係，先忙你的。等你有空再約。"}
      }
    },
    lia: {
      start:"welcome",randomStart:"invite",
      nodes:{
        welcome:{initial:true,response:"說好了喔，我先把那間店存起來 ☺️",choices:[{id:"reply",text:"好啊，下次一起去！"}]},
        invite:{message:"{{nickname}}，我看到一家新開的甜點店，要不要一起去？",choices:[
          {id:"yes",text:"好啊，想和你一起吃甜點。",next:"yes"},
          {id:"takeout",text:"買回來一起吃好不好？",next:"takeout"}
        ]},
        yes:{message:"那我把地址傳給你，我們在店門口見 ☺️"},
        takeout:{message:"好主意。你想吃什麼？我順路帶過去。"}
      }
    },
    ryujin: {
      start:"welcome",randomStart:"invite",
      nodes:{
        welcome:{initial:true,response:"剛忙完就先休息一下，晚點再找你。",choices:[{id:"reply",text:"剛忙完，在想要不要找你出去。"}]},
        invite:{message:"{{nickname}}，晚上要不要一起看電影？",choices:[
          {id:"choose",text:"好啊，這次讓我選片。",next:"choose"},
          {id:"walk",text:"比起電影，我比較想和你出去走走。",next:"walk"}
        ]},
        choose:{message:"可以。那爆米花我選。"},
        walk:{message:"也行。我們一起想想要去哪。"}
      }
    },
    chaeryeong: {
      start:"welcome",randomStart:"invite",
      nodes:{
        welcome:{initial:true,response:"那我就放心了，你也先休息一下 🤍",choices:[{id:"reply",text:"到家了，你也記得穿暖一點。"}]},
        invite:{message:"{{nickname}}，吃晚餐了嗎？",choices:[
          {id:"together",text:"還沒，要一起吃嗎？",next:"together"},
          {id:"dessert",text:"吃過了，但可以陪你吃。",next:"dessert"}
        ]},
        together:{message:"好啊，我也還沒吃。我們找間近一點的吧。"},
        dessert:{message:"那我請你吃飯後甜點。"}
      }
    },
    yuna: {
      start:"welcome",randomStart:"invite",
      nodes:{
        welcome:{initial:true,response:"約好了！看到漂亮的天空也要傳給我喔。",choices:[{id:"reply",text:"好漂亮！下次一起看天空。"}]},
        invite:{message:"{{nickname}}！我想出去拍照，你陪我好不好？",choices:[
          {id:"photos",text:"好，我幫你拍。",next:"photos"},
          {id:"together",text:"可以，但你也要跟我一起入鏡。",next:"together"}
        ]},
        photos:{message:"那我要把今天拍得最好看的那張留給你🎀"},
        together:{message:"當然！我連合照的姿勢都想好了。"}
      }
    }
  },

  // 7. 額外來訊與關鍵字回覆：目前皆留空，不會產生 AI 回覆。
  // incomingMessages 在新存檔中排程；delay 從建立進度起算，開局設定期間會暫停計時。
  // 範例：{ id:"hello-1", channel:"kakao", member:"yeji", delay:5000, text:"你今天有空嗎？" }
  incomingMessages: [],
  // keywordRules 按 App 分組；成員與任一關鍵字符合時，才依序送出 replies。
  // 規則 id 不可重複；once: true 表示每份存檔只觸發一次，delay 是逐則回覆的間隔。
  // kakao 陣列範例：{ id:"dinner", member:"yeji", keywords:["吃飯","晚餐"], replies:["想吃什麼？"], delay:1200, once:true }
  keywordRules: { kakao: [], instagram: [] },

  // 8. 配圖劇情：玩家選相簿中的成員照片分享後觸發，每位成員每份存檔只觸發一次配圖互動。
  // 順序：本人私訊 → 本人發貼文 → 本人在玩家貼文留言 → 其他成員留言 → 本人再次私訊。
  // 分享限動也可觸發私訊與對應貼文，但不產生公開留言；成員的對應照片會發成貼文。
  photoEvents: {
    dmDelay: 8000,        // 玩家分享後，等待第一則私訊：8 秒。
    postDelay: 30000,     // 第一則私訊出現後，等待成員發貼文：30 秒。
    followUpDelay: 8000,  // 最後一則預定成員留言出現後，等待本人再次追問：8 秒。
    // question 是第一則私訊，caption 是成員貼文說明，followUp 是本人再次追問的私訊。
    scripts: {
      yeji: { followUp:"{{nickname}}，我的貼文你看到了嗎？你還沒跟我說，怎麼突然想發那張照片 🖤", question:"{{nickname}}，怎麼突然把這張放上來了？", caption:"美好的夜晚🖤" },
      lia: { followUp:"我也把那天的照片放上去了。{{nickname}}，所以是突然想起那天了嗎？", question:"{{nickname}}，你上傳了那天的照片？為什麼突然想到這張 ☺️", caption:"🤎" },
      ryujin: { followUp:"看到我剛發的了吧？所以，怎麼突然挑了那張？", question:"{{nickname}}，這張你居然還留著。怎麼突然發了？", caption:"" },
      chaeryeong: { followUp:"我也發了那天的照片。{{nickname}}，你是不是也有點想再一起出去了？", question:"{{nickname}}，是我們那天拍的……你怎麼選了這張？", caption:"想把那天再留久一點" },
      yuna: { followUp:"{{nickname}}，看到我發的照片了嗎！所以你今天怎麼突然想放那張呀？", question:"{{nickname}}！這張！你怎麼突然發上來了 🥺", caption:"❤️🖤" }
    }
  },

  // 9. 玩家貼文的成員留言：照片本人必定留言，其他成員隨機留正面回應。
  // 相同照片再次發成新貼文，仍會產生新留言；配圖私訊互動則不重播。
  // 首次分享時，memberDelay / otherDelay 從成員發出對應貼文起算；重複分享則從玩家發文起算。
  postComments:{
    memberDelay:15000,    // 成員發出對應貼文後，等待本人在玩家貼文留言：15 秒。
    otherDelay:20000,     // 從成員發出對應貼文起算，其他成員最早開始留言：20 秒。
    spacing:3000,        // 本人留言之後，其他成員逐一留言的間隔：3 秒。
    otherChance:0.5,      // 每位其他成員觸發留言的機率，0～1；目前為 50%。
    maxOthers:2,          // 每則玩家貼文最多有幾位其他成員留言。
    replyLikeDelay:10000, // 玩家回覆留言後，對方替該回覆按讚的等待時間：10 秒。
    // contexts 由上往下比對，採用第一個符合的情境；貼文說明為空時使用照片說明。
    // keywords 任一詞符合即可；exclude 任一詞符合時，略過該情境。
    // memberReplies 是照片本人的台詞，otherReplies 是其他成員的台詞；每次各隨機抽一句。
    contexts:[
      {id:"sentSelfie",keywords:["傳來的自拍","傳給我的自拍","傳給你的自拍"],exclude:["不是自拍","並非自拍","非自拍"],
        memberReplies:["那張自拍你還留著喔ㅋㅋㅋ", "你居然發這張自拍", "這張自拍我自己也喜歡"],
        otherReplies:["自拍也太漂亮", "這張自拍可愛欸", "這張自拍我先存"]},
      {id:"selfie",keywords:["自拍","selfie","셀카","selca"],exclude:["不是自拍","並非自拍","非自拍"],
        memberReplies:["這張自拍我也喜歡", "原來你喜歡這張自拍", "我先把這張自拍存回去"],
        otherReplies:["自拍也太好看", "這張自拍可愛", "好喜歡這張自拍"]},
      {id:"coffee",keywords:["咖啡","cafe","café"],
        memberReplies:["這張咖啡廳的照片好有氣氛 ☕","看到這張，又想喝咖啡了。","這張喝咖啡時的照片我喜歡。"],
        otherReplies:["咖啡照好有氛圍，拍得真好。","喝咖啡的照片也好好看 ☕","這張咖啡照的感覺好舒服。"]},
      {id:"meal",keywords:["吃飯","晚餐","午餐","早餐","餐廳","聚餐","吃東西","dinner","lunch"],
        memberReplies:["看到這張又餓了", "那天吃飯真的好開心", "這頓飯是不是該再約一次"],
        otherReplies:["吃飯都拍得這麼好看", "吃飯這張好自然", "這個吃飯的表情好可愛"]},
      {id:"shopping",keywords:["逛街","購物","買衣服","百貨","商場","shopping"],
        memberReplies:["又想去逛街了", "逛街那天你到底拍了幾張ㅋㅋ", "下次逛街還找你"],
        otherReplies:["逛街也拍得好好看", "逛街這張好自然", "好喜歡這張逛街照"]},
      {id:"outing",keywords:["出去玩","出遊","旅行","旅遊","散步","郊遊"],
        memberReplies:["那天真的玩得好開心", "下次出去玩還帶你", "又想出去了怎麼辦"],
        otherReplies:["出遊照拍得好好看", "這張看起來好開心", "好喜歡你們出去玩的照片"]},
      {id:"portrait",keywords:["我拍的","我幫","幫她拍","幫她照"],
        memberReplies:["這張你拍得不錯欸", "那下次也交給你了", "原來你那天拍到這張"],
        otherReplies:["你真的好會拍", "這個角度喜歡", "攝影師有點厲害"]}
    ],
    // 未符合任何情境時，依成員抽選中性留言，避免假設拍攝者或行程。
    memberReplies:{
      yeji:["這張我喜歡 🖤","這張我想存起來。","原來你選了這張，眼光很好欸。"],
      lia:["這張好溫柔，喜歡 ☺️","謝謝 {{nickname}} 分享這張照片。","好喜歡這張的感覺 🤍"],
      ryujin:["可以，這張選得很好。","這張看起來不錯。","這張我收走了。"],
      chaeryeong:["這張好喜歡，謝謝你 🤍","這張的感覺好好看。","好開心你分享了這張照片。"],
      yuna:["哇！這張我喜歡 ❤️","這張我要存起來！","我喜歡這張，你好會選！"]
    },
    otherReplies:{
      yeji:["這張真好看，很有氛圍。","這個角度好好看。","這張的感覺很自然。"],
      lia:["這張真的好漂亮 🤍","好喜歡這個光線。","這張看起來好舒服。"],
      ryujin:["這張不錯。","這張有水準。","這個構圖很好看。"],
      chaeryeong:["拍得真好，看起來好溫柔。","這張好自然，我喜歡。","好喜歡這張的顏色，好漂亮。"],
      yuna:["這張也太好看了吧！","這張超好看！❤️","這張照片好有氛圍！"]
    }
  },

  // 10. 粉絲留言與自然讚數：[最小值, 最大值] 是隨機範圍，包含兩端。
  // 成員貼文約有一百則粉絲留言；玩家貼文也有少量粉絲留言。互動會隨進度保存。
  memberAudience:{
    fanPoolSize:1200,       // 共用的虛構粉絲帳號池人數；每則貼文從中抽選留言者。
    commentCount:[95,105],  // 每則成員貼文的粉絲留言數。
    initialLikes:[1500,4500], // 成員貼文的起始自然讚數。
    likesPerMinute:[36,96], // 每則成員貼文隨機選定的每分鐘增讚數。
    refreshMs:5000,         // 畫面更新讚數的間隔：5 秒；重新開啟會依經過時間補上讚數。
    playerLikesPerMinute:[4,12], // 玩家貼文每分鐘自然增讚數，從粉絲帳號中抽選。
    playerMaxLikes:240,     // 玩家貼文的粉絲讚數上限；玩家自己按的讚另計。
    playerCommentCount:[5,10], // 每則玩家貼文的粉絲留言數。
    playerCommentDelay:[4000,10000], // 成員留言之後，等待第一則粉絲留言的時間。
    playerCommentSpacing:[2500,7000], // 後續粉絲留言逐則出現的隨機間隔。
    emojiChance:0.22,       // 粉絲留言加上 emoji 的比例；多數使用純文字。
    // 帳號混合人名、生活用字與不同格式；偶爾附上數字，不使用固定 midzy 前綴或流水號。
    // 這些是合成 ID 的素材，不會連線取得真實帳號；留言介面只顯示 ID。
    usernameNames:["seoyeon","minji","yujin","jiwoo","sohee","eunseo","yuna","sumin","haeun","nayeon","jiyeon","hyerin","dayeon","sua","dahye","chaewon","yerim","jiyu","seohyun","hyewon","eunji","suyeon","harin","yeonwoo","jimin","jina","nana","mimi","yuri","rina","haruka","aoi","yui","saki","mei","mika","hina","kaori","akari","ayaka","claire","chloe","ellie","sophie","luna","emily","alice","ella","jenny","lily","hazel","ruby","iris","nora","zoe","mia","aria","ivy","evie","celine","annie","daisy","sienna","amber","nina","lea","yaya","momo","sora","rin","linlin","chia","yuting","hsuan","wenwen","peiyu"],
    usernameSurnames:["kim","lee","park","choi","jung","han","yoon","seo","lim","shin","moon","cho","song","baek","kwon","oh","jo","ryu","kang","jeon"],
    usernameWords:["peach","midzy","seoul","starlight","velvet","mango","cherry","cloud","moon","spring","bloom","sunny","heart","coffee","matcha","latte","vanilla","cocoa","honey","lemon","melon","apricot","olive","cookie","toast","butter","cinnamon","monday","sunday","friday","summer","winter","autumn","april","june","august","rain","snow","ocean","river","forest","garden","petal","lilac","rose","tulip","clover","mint","sage","willow","birch","maple","cotton","linen","ribbon","pearl","silver","golden","dawn","sunset","twilight","night","daylight","afternoon","morning","mellow","cozy","tiny","little","soft","slow","blue","pink","lilies","doodle","bunny","kitty","tangerine","weekend","afterglow","warmth","music","piano","vinyl","polaroid"],
    usernamePrefixes:["dear","its","im","hey","hello","with","by","luv","my","oh","only","daily","little","stay","from","for","still","just","always","thisis"],
    usernameSuffixes:["archive","diary","film","jpg","jpeg","zip","log","room","days","notes","studio","page","letters","memo","daily","mood","club","corner","palette","onfilm","playlist","moments","sketch","journal","camera","stories","postcard","gallery","pixels","hour"],
    // 可用 {{name}}、{{surname}}、{{prefix}}、{{word}}、{{word2}}、{{suffix}}、{{initial}}、{{stretchedName}}。
    usernameFormats:["{{name}}.{{suffix}}","{{name}}_{{word}}","{{prefix}}.{{name}}","{{surname}}.{{name}}","{{word}}.{{suffix}}","{{name}}__{{suffix}}","{{word}}_{{word2}}","{{name}}{{word}}","{{prefix}}_{{word}}","{{stretchedName}}.{{suffix}}","{{name}}.{{word}}","{{word}}by{{name}}","{{initial}}_{{word}}_{{suffix}}","{{name}}_{{suffix}}_","{{word}}.and.{{word2}}","{{prefix}}{{name}}"],
    usernameNumberChance:0.28, // 附上短數字、年份或月日風格數字的機率，0～1。
    // 頭貼底色與留言結尾的 emoji。
    colors:["#e8cdd4","#cddce8","#d9d4eb","#d6e3cc","#f0d8bf","#d0e4df","#e8d0db","#d7dbe5"],
    emojis:[""," 🤍"," ❤️"," ✨"," 🥹"," 😍"," 💖"," 🌷"],
    // 每句台詞可隨機加上 emoji；同篇貼文只使用一次，{{member}} 會代入成員名稱。
    compliments:[
      "好好看","這張真的漂亮","救命 好美","這張我先存了",
      "怎麼這麼好看啦","這個光好漂亮","好喜歡這張","看了好幾次才滑走",
      "今天這張太可以了","這個表情好可愛","也太溫柔","美到我停下來",
      "喜歡這個感覺","真的會看很久","我又回來看一次","這張直接桌布",
      "笑起來好好看","完全是我的取向","這張有夠喜歡","啊啊啊好漂亮",
      "也太適合這個光","好自然的一張","這張先收藏","怎麼又更好看了",
      "看到更新就跑來了","好可愛喔","這個角度喜歡","漂亮得有點過分",
      "今天也是漂亮的人","好看就算了還這麼可愛","我宣布這張是今天最愛","這張不能只有我看到",
      "美得我忘記要說什麼","本來想滑走結果停住","看一次再看一次","這張照片有聲音嗎 好像在笑",
      "好想存原圖","這張的顏色好舒服","太喜歡了啦","這個笑容我收下了",
      "好看得很輕鬆欸","看著就心情很好","照片好有生活感","這張好有電影的感覺",
      "好喜歡這種自然的照片","不用做什麼就很好看","太犯規了吧","點開就不想關了",
      "這張怎麼能不按讚","存好了 謝謝分享","就是喜歡這個樣子","有被漂亮到",
      "這張讓我重看好幾遍","不用挑角度也漂亮","好想把這張印出來","超級喜歡這張",
      "好漂亮 我詞窮了","每次更新都會跑來看","等等這張真的好好看","這張是可以免費看的嗎",
      "眼神好溫柔","這個氛圍好棒","好喜歡這次的照片","看見照片就笑了",
      "今天也有被可愛到","照片裡的笑容太好了","這張的光線好乾淨","拜託多發這種照片",
      "再多一張好不好","好看得我捨不得滑掉","我的首頁謝謝你","這張真的要留著",
      "不是 第一次看就好喜歡","我今天的快樂來源","不用修就很好看吧","真的好適合這個顏色",
      "我怎麼還在這裡看","每次都說最後看一次","這張好像朋友幫忙拍的 好自然","好喜歡這種隨手拍",
      "超好看！！！","漂亮漂亮漂亮","好可愛ㅋㅋㅋ","예쁘다",
      "너무 예뻐","so pretty","love this photo","this one is so cute",
      "pretty as always","這張也太可愛了吧","{{member}} 這張好漂亮","{{member}} 笑起來真的好好看",
      "{{member}} 今天也好可愛","{{member}} 這張我存了","{{member}} 拜託多發一點","看到 {{member}} 就忍不住按讚",
      "這種感覺很適合 {{member}}","{{member}} 這個表情太可愛","喜歡 {{member}} 這樣自然的樣子","{{member}} 的照片我真的看不膩",
      "捨不得滑走的一張", "首頁突然變漂亮了", "這個瞬間抓得太好了", "照片好有溫度",
      "這張光影好喜歡", "今天的收藏又加一張", "怎麼連隨手拍都這麼美", "每次看到都忍不住笑",
      "這個眼神我可以看一天", "好像電影停格的畫面", "這張有讓我心動", "好喜歡這次的色調",
      "這張真的值得放大看", "看完照片心情變好了", "這個表情真的好靈"
    ],
    // 玩家配對照片：稱讚拍攝與照片中的成員；任意裝置照片只使用一般攝影稱讚。
    playerCompliments:[
      "你也太會拍","這張拍得好好看","攝影師有點東西欸","好會抓角度",
      "這張我想存","光線抓得好漂亮","這個構圖好喜歡","好喜歡你拍的照片",
      "鏡頭裡的人也太漂亮","人好看 照片也好看","拍得好自然","攝影師跟模特兒都好厲害",
      "{{member}} 這張太好看了吧","你把 {{member}} 拍得好漂亮","這張 {{member}} 我先收藏","{{member}} 好適合你的鏡頭",
      "這張笑得好可愛","可以多發幾張嗎","這個角度的 {{member}} 好喜歡","這張好像雜誌照",
      "你拍的 {{member}} 好自然喔","這個光加上 {{member}} 太剛好了","照片裡的人真的好漂亮","這張可以直接當桌布",
      "好會拍 再多拍一點","兩個都太厲害了啦","怎麼隨手拍都這麼好看","好會捕捉表情",
      "這個畫面好舒服","又有新的收藏了","拜託繼續拍下去","這張真的拍進我心裡",
      "照片也太有生活感","{{member}} 笑得好開心","這張 {{member}} 太可愛了","給攝影師一個讚",
      "好看的照片要按兩次愛心","沒忍住放大看了","求你們多拍一點","拍得真好 人也真的好看"
    ],
    playerPhotoCompliments:[
      "好會拍","這張好好看","這個光好漂亮","照片的顏色好舒服",
      "這個構圖喜歡","好喜歡這張的感覺","這張先收藏","光線抓得好好",
      "拍得好有生活感","這張看著好舒服","好會找角度","想知道用什麼拍的",
      "好喜歡你拍的照片","這張有電影的感覺","給攝影師按讚","好會拍 再多發一點"
    ]
  },

  // 11. 示範限動與簡訊。
  // seedStories 是舊版開局示範限動開關，目前保持關閉；不影響玩家自行發佈限動。
  seedStories: false,
  // 唯讀的生活情境簡訊；name 是寄件者，time 是顯示文字，messages 按順序排列。
  sms: [
    { id:"delivery", name:"CJ 大韓通運", time:"10:12", messages:["[配送通知] 您的包裹已送達，放置於家門口。訂單尾碼 0423。", "如有配送問題，請透過購物平台聯絡客服。"] },
    { id:"bank", name:"新韓銀行", time:"昨天", messages:["[刷卡通知] 10/23 14:28，咖啡廳消費 5,500 韓元。", "若非本人交易，請透過銀行 App 查詢。"] },
    { id:"carrier", name:"SK Telecom", time:"星期四", messages:["[用量提醒] 本月行動數據已使用 80%。連上 Wi-Fi 後可繼續使用網路服務。"] },
    { id:"verification", name:"驗證碼", time:"星期三", messages:["[登入驗證] 您的驗證碼是 482619。請勿將驗證碼提供給任何人。"] }
  ]
};
