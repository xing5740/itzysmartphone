# itzy phone

以台灣中文製作的 iPhone 手機模擬網頁。玩家是住在韓國、與 ITZY 五位成員熟識的女生。純 HTML、CSS、JavaScript，不需要 API key、後端或安裝套件，支援 GitHub Pages 的 repository 子路徑。

本作為非官方同人遊戲；人物互動、聊天內容、發文和通話紀錄皆為虛構。所有操作只發生在遊戲中。

## 開啟預覽

直接用瀏覽器開啟 **preview.html**，即可先試玩。請將它和其他資料夾保存在一起，照片與桌布才會顯示。直接以檔案模式開啟時，部分瀏覽器會限制儲存及圖片上傳；正式使用請透過 HTTP 或 GitHub Pages。

本機開發（需 Node.js 20+、Python 3）：

```sh
npm run dev
```

打開 `http://127.0.0.1:4173`。正式入口是 **index.html**。

`preview.html` 是由原始碼產生的直接開啟版。每次修改程式後執行 `npm run preview:build` 更新；GitHub Pages 不依賴這個檔案。

## 已完成功能

- 畫面只顯示無實體按鍵、無動態島的手機；點擊或上滑底部橫槓回到主畫面。鎖定畫面與桌面使用白色文字，桌面只有一頁。
- 首次開始前設定 Instagram ID 與成員對你的稱呼；開始按鈕下方顯示照片來源及 AI 生成聲明，預設頭貼為 MIDZY。舊存檔會保留進度，並在首次更新時補上這個設定步驟。
- 上滑、點擊或 Enter 無密碼解鎖。可從桌面的「設定」進入「鎖定螢幕」。
- 首爾天氣小工具：固定保存 2026/10/24 的資料；點小工具查看日期及來源，不會每日更新。
- KakaoTalk：好友頁、聊天頁、五個獨立聊天室、訊息輸入、未讀數、由劇本控制的成員來訊、預留空白的關鍵字回覆規則。
- 選項式對話：只在 KakaoTalk 啟用，五位成員的歡迎訊息各有一個選項，玩家點選後由成員回應，再結束該段歡迎對話。各成員在歡迎對話收到最後回應後，才會加入隨機日常對話的候選。Instagram 保留貼文相關私訊，不啟用選項劇本。
- 五位成員的 KKT 聊天室都在傳送按鈕旁提供 ❤️ 快速傳送；各有三組隨機回覆，每次從對應成員的三組中選一組，依序顯示該組訊息。
- Instagram：聊天室依最新訊息時間排序（最新在上，包含自己傳送的訊息）、24 小時限動、觀看與暫停限動、每則貼文一張照片、留言、留言按讚與討論串回覆、貼文按讚、珍藏、五個私訊聊天室、貼文分享到私訊、我的已發佈貼文與個人檔案。
- 照片：五張照片建立存檔時各分配一個 1～7 天前的日期，依時間由近到遠排序。支援上一張、下一張，以及可編輯並自動儲存的照片說明；可分享到貼文或限動，觸發對應私訊和發文劇情。
- 電話：五位成員的通話記錄、通話詳細資料、聯絡人及查詢。撥號停用。
- 訊息：韓國生活情境的配送、銀行、電信、驗證碼等示範通知。Safari、相機尚未開放。
- 進度自動儲存在使用者目前的瀏覽器，包含裝置上傳的照片；支援「重新開始」。不同裝置不會自動同步。
- 「重新開始」會清空 Instagram 貼文、留言、按讚、珍藏、限動、私訊、草稿與劇情排程，並重設玩家資料。新進度儲存完成後才回到設定畫面；同步更新 IndexedDB 與備援存檔，避免舊進度在切換儲存方式時回復。重置前排隊中的存檔與舊分頁存檔會被略過。
- 桌面「設定」可改玩家姓名、帳號、稱呼、簡介及頭貼，以及鎖定螢幕或重新開始。玩家介面不提供編輯好友來訊、匯出或匯入存檔。

## 放入你的圖片

程式已依照 `xing5740/itzysmartphone` repository 的現有圖片結構設定，使用你提供的 `.jpg` 素材。**檔名全部使用小寫**，GitHub Pages 會區分大小寫。

| 用途 | 路徑 |
| --- | --- |
| 鎖定桌布 | `photo/lockscreen.jpg` |
| 主畫面桌布 | `photo/homescreen.jpg` |
| 成員 Instagram 頭貼 | `photo/ins/profile/yeji.jpg` 等 |
| 成員 KakaoTalk 頭貼 | `photo/kkt/profile/yeji_kkt.jpg` 等 |
| 我的頭貼 | 預設字母圖示，可在遊戲設定上傳 |
| 電話聯絡人頭貼 | 目前沿用 `photo/ins/profile/yeji.jpg` 等現有頭貼 |
| 我要分享的 Yeji 照片 | `photo/ins/yeji/me.jpg` |
| Yeji 隨後分享的對應照片 | `photo/ins/yeji/her.jpg` |

`yeji`、`lia`、`ryujin`、`chaeryeong`、`yuna` 都已提供頭貼及 `me.jpg`、`her.jpg`。所有配對照片位於 **photo/ins/**，不需要建立根目錄的 **ins/** 資料夾。Yuna 也已使用 `me.jpg`、`her.jpg`。

如果之後新增獨立的電話頭貼，可在 `js/config.js` 調整 `assets.phoneAvatar`，例如 `id => \`photo/phone/${id}.jpg\``。

缺圖時的五張替代插畫不代表真人照片。初始限動使用各成員的 `her.jpg`，可在 `js/config.js` 將 `seedStories` 改成 `false`。

## 編輯劇本

所有故事設定集中在 **js/config.js**。

- `player`：開局表單的預設姓名、帳號、稱呼、簡介、頭貼；完成設定後以存檔為準。
- `photoDescriptions`：五張照片的預設說明；玩家在照片內修改後以存檔為準。
- `members`：成員的顯示名稱與帳號。
- `initialMessages`：新存檔的開場訊息。範例可修改或清空陣列。
- `dialogues`：五位成員的選項式對話；`dialogueChannels` 決定啟用的 App。
- `kakaoEmoji.value`：所有 KKT 聊天室共用的快速傳送 emoji，目前為 ❤️。
- `kakaoEmoji.replies`：依 `yeji`、`lia`、`ryujin`、`chaeryeong`、`yuna` 分別設定收到單獨一顆 ❤️ 後的三組隨機台詞；每組陣列依序傳送多則訊息，間隔由 `kakaoEmoji.delay` 設定。
- `incomingMessages`：遊戲開啟後排程的主動來訊，預設留空。
- `keywordRules`：KakaoTalk 與 Instagram 的關鍵字規則，預設兩者皆為空陣列，不會產生自由文字 AI 回覆。
- `photoEvents.scripts`：你發照片後，成員的第一則私訊 `question`、貼文文案 `caption` 與本人再次追問的 `followUp`。
- `postComments`：照片本人必留的留言與其他成員的隨機正面回應；`contexts` 依描述比對情境，`otherChance` 與 `maxOthers` 控制其他成員的觸發機率與人數。
- `weather`：固定天氣快照與來源。

開場資料、排程、初始限動只在建立新存檔時套用。修改後可到「設定 → 重新開始」套用新的初始資料；此操作需再次確認，並會清除目前瀏覽器的進度。照片事件台詞和關鍵字設定在重新載入頁面後即使用新的程式設定，但已完成的事件不會重播。成員來訊編輯不提供玩家端操作介面。

成員訊息可使用 `{{nickname}}`，畫面會代入玩家設定的稱呼；`{{name}}` 會代入玩家的顯示名稱。聊天紀錄不會把未替換的模板顯示給玩家。照片的隨機日期與編輯說明都會隨存檔保存，重新整理不會重新抽選。

### 設定有選項的對話

編輯 `js/config.js` 的 **dialogues → 成員名字 → nodes**。例如 Yeji 的劇本位於 `dialogues.yeji`。`start` 目前指定 `welcome`，每位成員各有一個歡迎回覆選項，放在輸入框上方。流程是「成員開場 → 玩家選擇回覆 → 成員回應後結束」，最後回應由 `welcome.response` 設定，等待時間由 `welcome.responseDelay` 設定（預設 1200 毫秒）。`welcome.initial: true` 會沿用原有歡迎訊息，不再重傳一次。A 成員的歡迎對話收到最後回應後，即可開始隨機計時，從 A 的 `randomStart` 指定節點開啟日常對話，不必等待其他成員。

```js
yeji: {
  start: "welcome",
  randomStart: "invite",
  nodes: {
    welcome: {
      initial: true,
      response: "那就好，別又忙到忘記吃飯 🖤",
      choices: [{ id: "reply", text: "我有好好吃飯，你也是 🖤" }]
    },
    invite: {
      message: "{{nickname}}，今天有空嗎？",
      choices: [
        { id: "yes", text: "有空，想見你。", next: "meet" },
        { id: "later", text: "今天有點忙，改天好嗎？", next: "later" }
      ]
    },
    meet: { message: "那我去找你。" },
    later: { message: "好，你忙完再跟我說。" }
  }
}
```

| 欄位 | 意思 |
| --- | --- |
| `start` | 歡迎節點名稱，必須在 `nodes` 裡存在 |
| `randomStart` | 隨機日常對話開始時要走的節點名稱 |
| `message` | 成員說的話，可使用 `{{nickname}}` |
| `initial` | 起始節點設為 `true` 時，沿用已存在的歡迎訊息並顯示選項 |
| `response` | 歡迎對話專用，玩家點選後才送出的成員最後回應 |
| `responseDelay` | 歡迎最後回應的延遲，預設 1200 毫秒 |
| `choices` | 顯示給玩家點選的回覆按鈕；省略時該段對話結束 |
| `choices[].id` | 選項識別碼，同一個節點內不可重複 |
| `choices[].text` | 玩家按下後送出的文字 |
| `choices[].next` | 要接到哪個節點；可繼續放更多選項 |
| `choices[].delay` | 回覆延遲的毫秒數，選填，預設 900 |

`randomDialogues.delay` 預設為 `[45000,120000]`：有成員完成「開場、玩家回覆、成員最後回應」後，等待隨機 45～120 秒，從已完成歡迎對話的成員中抽選一位主動來訊。這是日常互動遊戲，沒有主線。A 的日常對話尚未結束時，即使 B 在這段時間完成歡迎對話，也不會觸發 B；結束後再抽下一個時間點，同一段對話不重複播送。計時、進行中的對話和完成紀錄都會存檔。

目前設定為 `dialogueChannels: ["kakao"]`，選項只會出現在 KKT。Instagram 的成員私訊由 `photoEvents.scripts` 的貼文互動觸發。等待選項回覆時會暫時收起按鈕並顯示輸入狀態，避免連點重複送出。

五位成員聊天室的 ❤️ 都是直接傳送按鈕，放在輸入框右側、傳送按鈕旁，點按時會保留輸入框中尚未送出的文字。對任何一位成員單獨手動輸入 ❤️ 後按傳送，也會觸發她的隨機回覆。這個互動不會推進原本的選項分支；Instagram 保留貼文互動。

重新整理會接續既有分支，不會重播開場。若要重新測試已完成的劇本，可在「設定 → 重新開始」重設整份進度；修改尚未走到的節點後，重新整理即可使用新的台詞。編輯器不會出現在玩家設定中；目前由程式設定檔管理。

主動來訊範例（放入 `incomingMessages`）：

```js
incomingMessages: [
  { id: "yeji-hello-1", channel: "kakao", member: "yeji", delay: 5000, text: "你今天有空嗎？" }
],
```

關鍵字範例（加入 `keywordRules.kakao`）：

```js
{
  id: "dinner-yeji",
  member: "yeji",
  keywords: ["晚餐", "吃飯"],
  replies: ["想吃什麼？", "我等等找你。"],
  delay: 1200,
  once: true
}
```

`delay` 單位是毫秒，`once: true` 代表同一規則每份存檔只觸發一次；`once: false` 可重複觸發。規則需有不同 `id`。聊天文字、留言與名稱會以文字方式顯示，不會當成 HTML 執行。

## 照片劇情規則

從遊戲內「照片」或發文視窗的「最近項目」選擇照片，才能攜帶成員配對資料；一般從裝置上傳的任意圖片不會猜測成員身分。新貼文一次只選一張照片；重新選擇會替換原本的照片。由照片分享到貼文時會先帶入該照片的說明，仍可在發文前修改。從裝置選圖也僅接受一張。

1. 你分享 A 的 `me.jpg` 貼文。
2. 約 8 秒後，A 在 Instagram 私訊詢問。
3. 從私訊送出起，再隔 30 秒，A 發佈 `her.jpg` 對應貼文。
4. 從 A 發佈貼文起，再隔 15 秒，A 在你的貼文留言。
5. 其他成員依隨機機率接著留言；預設從 A 發文後第 20 秒開始，彼此間隔 3 秒，最多兩人。
6. 最後一則預定成員留言出現後，再隔 8 秒，由 A 本人私訊追問。

`photoEvents.messageSpacing` 控制同一段發文私訊拆成多則時的間隔（目前 1.5 秒），每則從上一則實際送達後起算，重新整理會保留尚未傳送的內容。貼文不顯示地址。

`photoEvents.postDelay` 控制私訊到成員貼文的間隔；`postComments.memberDelay` 控制成員貼文到本人留言的間隔，`otherDelay` 控制其他成員開始留言的時間，`spacing` 控制留言間距。`photoEvents.followUpDelay` 控制留言結束到 A 本人再次追問的間隔。其他成員只在貼文底下隨機留言，不會因為配對貼文而私訊詢問。

其他成員的留言會排在照片本人之後。每一對配圖每份存檔只觸發一次私訊與配圖貼文；再次分享同一張照片仍會產生新留言。玩家分享限動仍可觸發私訊和成員配圖貼文，但不會產生公開留言。

劇情佇列會存檔，關閉後再進入仍會依序繼續。分頁暫停導致階段延遲時，後續間隔會從實際出現的階段計時。重新載入會清除舊版自動生成的示範限動，保留玩家自行發佈的限動；配圖劇情只產生成員貼文。舊存檔尚未完成的排程會更新，已完成的劇情不會重播。

### 貼文留言

每次把相簿中的成員照片發成貼文，照片本人都會在該則貼文下留言。其他成員各有 50% 的觸發機率，一則貼文最多再加入兩位成員的正面回應。同一張照片再次發成新的貼文時，會產生新留言；既有的配圖私訊互動仍只觸發一次。限時動態不產生公開留言。

留言依發文時的說明判斷；貼文說明為空時，使用照片本身的說明。自拍、傳來的自拍、咖啡、吃飯、逛街、出遊、玩家幫忙拍照會使用對應台詞，未知情境則使用中性的稱讚。

目前採用本機關鍵字規則，沒有串接 AI 服務。可在 `postComments.contexts` 增加情境，依順序比對 `keywords`，用 `exclude` 排除不適用的描述，並填入照片本人使用的 `memberReplies` 和其他成員使用的 `otherReplies`。例如「不是自拍」不會觸發自拍回應。

留言和排程會保存在瀏覽器，重新整理不會重複留言。留言視窗開啟時會即時更新，並保留玩家尚未送出的留言內容。

留言右側的小愛心可按讚／取消按讚，留言下方顯示讚數及「回覆」。回覆會以縮排討論串呈現，帶上被回覆帳號的 @提及；可展開或收起回覆。讚數是純文字，不可點擊，也不顯示按讚名單。

玩家回覆某位成員的留言後，該成員會在約 10 秒後對玩家的那則回覆按讚，並顯示通知和更新讚數；延遲由 `postComments.replyLikeDelay` 設定。一般新增留言及回覆自己的留言不會觸發自動按讚。按讚的人、回覆關係及等待中的按讚排程都會隨瀏覽器存檔保存。

## 發佈到 GitHub Pages

目標 repository：<https://github.com/xing5740/itzysmartphone>。本機專案與 Git repository 根目錄均為 `/Users/claire/Documents/ChatGPT/itzy撿手機/itzysmartphone`，目前分支為 `main`。在此目錄修改後，仍需提交並推送才能觸發部署。正式上線步驟：

1. 確認程式位於這個 repository 的根目錄，與既有 `photo/` 資料夾並列。
2. 提交並推送程式變更到 `main` 分支（也支援 `ver1`）。`index.html` 要放在 repository 根目錄。
3. 打開 repository 的 **Settings → Pages → Build and deployment → Source**，選擇 **GitHub Actions**。
4. 到 **Actions** 執行／重跑 **Deploy itzy phone to GitHub Pages**。檢查及測試通過後，工作流程會發佈網站，並在部署環境顯示網址。
5. 正式網址通常是 `https://xing5740.github.io/itzysmartphone/`；以 GitHub 顯示的實際部署網址為準。

也可以不用 Actions：在 Pages 的 Source 選 **Deploy from a branch**，選擇要發佈的 `ver1` 或 `main` 分支，以及 `/(root)`。根目錄已有 `.nojekyll`。

不要把個人遊戲存檔上傳到 repository；它可能包含你的照片和對話。GitHub Pages 的靜態檔案可被瀏覽者讀取，素材與劇本請按你的公開範圍選擇。

官方部署說明：<https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>

## 檢查

```sh
npm run check
npm test
npm run preview:build
```

測試涵蓋五組 A→B 對應、訊息／貼文順序、重複觸發、多張照片、限動、存檔恢復、非配對圖片、觀察者條件、空白及自訂關鍵字、排程來訊、未讀數與無效存檔。另驗證開局表單、稱呼代入、設定前的排程暫停、舊存檔相容性、隨機照片日期、排序、前後切換與說明保存，以及瀏覽器存檔、重新開始確認與進度清除。分支對話測試涵蓋選項接續、防止重複點擊、延遲回覆、重新整理恢復，以及 App 之間的獨立進度。以最小 DOM 測試替身驗證互動接線；這些測試不取代真實瀏覽器驗證。

本次環境禁止啟動本機 HTTP 伺服器，瀏覽器安全政策亦不允許直接開啟 `file:` 網址，因此尚未完成真實瀏覽器的外觀、觸控、檔案上傳及 IndexedDB 實機驗證。部署前請在一般瀏覽器透過本機 HTTP 或 GitHub Pages 檢查這些項目。

## 資料來源與限制

- 帳號及顯示名稱於 2026/10/24 透過可取得的 Instagram 搜尋索引確認；Instagram 直接存取有防爬限制。頭貼使用 repository 裡已提供的圖片，不會自動抓取。
- YEJI `yezyizhere`：<https://www.instagram.com/yezyizhere/>
- LIA `lia_loves___`：<https://www.instagram.com/lia_loves___/>
- RYUJIN `iamfinethankyouandryu`：<https://www.instagram.com/iamfinethankyouandryu/>
- CHAERYEONG `chaerrry0`：<https://www.instagram.com/chaerrry0/>
- YUNA `igotyuandme`：<https://www.instagram.com/igotyuandme/>
- 首爾 10/24 日預報：多雲，最高 67°F（約 19°C）、最低 54°F（約 12°C），Time and Date／CustomWeather：<https://www.timeanddate.com/weather/south-korea/seoul/ext>。目前溫度與小時資料採建立時天氣查詢快照。
- 字型可選擇性載入 Google Fonts；無網路時使用系統字型。遊戲其他功能不需要外部服務。
- 已接上 repository 現有的桌布、五位成員頭貼和十張配對照片。圖片不會被重新命名或修改；網站是否已發佈，仍須以 GitHub 的實際部署結果為準。

KKT 與 Instagram 聊天列表依最後一則收發訊息的時間由新到舊排列，搜尋結果也使用相同順序。開場歡迎訊息時間相同時，依 Yeji、Lia、Ryujin、Chaeryeong、Yuna 的年齡順序排列；單純開啟或已讀不改變排序。KKT 好友列表維持年齡順序。

聊天訊息遇到句號會自動拆成多則訊息並移除句號，例如「我想你了。什麼時候一起出去玩？」會送出兩個訊息泡泡。此規則套用 KKT、Instagram 私訊、玩家輸入、選項回覆與簡訊；舊存檔的聊天記錄也會套用，保留已讀狀態與對話進度。問號、驚嘆號、emoji、刪節號及帳號／網址／小數中的點會保留；貼文說明與留言維持原文。

### 粉絲留言與時間

成員貼文會加入 95～105 則隨機正面粉絲留言，帳號、留言及互動保存在瀏覽器，重新整理不會重複產生。粉絲使用本機生成的帳號與字母頭貼，共用帳號池擴充為 1,200 人。ID 混合人名、姓氏、日常用字、句點、底線與少量數字，例如 `seoyeon.film`、`dear.haruka`、`kim.suyeon_24`，不使用固定 midzy 前綴或流水號。留言與回覆提及只顯示 ID，不另外顯示用戶名字；粉絲按讚僅顯示數字，團員按讚則在貼文讚數旁顯示帳號。舊版合成 ID 會在讀檔時一次更新，保留留言、回覆與按讚的關聯；之後重新整理不再改名。粉絲留言也可按讚或回覆，回覆約 10 秒後會收到對方的讚。

玩家貼文也會有 5～10 則粉絲留言，逐則出現，主要稱讚拍攝與照片中的成員；從裝置上傳而無法辨識成員的照片，只使用一般攝影稱讚。配圖貼文先保留成員本人和其他成員的留言順序，再加入粉絲留言。粉絲留言不延後照片本人原有的追問時間，也不逐則跳通知。`playerCommentCount`、`playerCommentDelay`、`playerCommentSpacing` 可調整人數與間隔。同一篇貼文的自動留言會避開已使用的句子，換 emoji 或標點也不視為新句子。留言以口語短句為主，混合少量 emoji；舊版成員貼文的合成粉絲留言會更新用字，保留原留言 ID、回覆和按讚。

`memberAudience` 可調整粉絲人數、誇誇台詞與讚數增長：成員貼文起始約 1,500～4,500 讚，每分鐘增加約 36～96 讚；玩家貼文每分鐘增加約 4～12 個粉絲讚，最多 240 個，會從粉絲帳號中抽選且不重複。自己的按讚與團員按讚另計；團員在玩家貼文留言時也會按讚，重複處理不會重複計數。畫面每 5 秒更新，重新開啟時會依經過時間補上讚數。

狀態列、鎖定畫面的日期時間及訊息時間使用瀏覽器的本地時區，時鐘每秒更新。首爾天氣仍使用固定快照。

粉絲 ID 素材可在 `memberAudience.usernameNames`、`usernameSurnames`、`usernameWords`、`usernamePrefixes`、`usernameSuffixes` 修改；`usernameFormats` 設定組合格式，`usernameNumberChance` 控制附加數字的機率。
