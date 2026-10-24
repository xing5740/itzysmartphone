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
- 首次開始前設定 Instagram ID 與成員對你的稱呼。舊存檔會保留進度，並在首次更新時補上這個設定步驟。
- 上滑、點擊或 Enter 無密碼解鎖。可從桌面的「設定」進入「鎖定螢幕」。
- 首爾天氣小工具：固定保存 2026/10/24 的資料；點小工具查看日期及來源，不會每日更新。
- KakaoTalk：好友頁、聊天頁、五個獨立聊天室、訊息輸入、未讀數、由劇本控制的成員來訊、預留空白的關鍵字回覆規則。
- Instagram：24 小時限動、觀看與暫停限動、單張／最多 10 張照片發文、輪播及左右滑、留言、按讚、珍藏、五個私訊聊天室、貼文分享到私訊、我的已發佈貼文與個人檔案。
- 照片：五張照片建立存檔時各分配一個 1～7 天前的日期，依時間由近到遠排序。支援上一張、下一張，以及可編輯並自動儲存的照片說明；可分享到貼文或限動，觸發對應私訊和發文劇情。
- 電話：五位成員的通話記錄、通話詳細資料、聯絡人及查詢。撥號停用。
- 訊息：韓國生活情境的配送、銀行、電信、驗證碼等示範通知。Safari、相機尚未開放。
- 進度自動儲存在使用者目前的瀏覽器，包含裝置上傳的照片；支援「重新開始」。不同裝置不會自動同步。
- 桌面「設定」可改玩家姓名、帳號、稱呼、簡介及頭貼，以及鎖定螢幕或重新開始。玩家介面不提供編輯好友來訊、匯出或匯入存檔。

## 放入你的圖片

程式已依照 `xing5740/itzysmartphone` repository 的現有圖片結構設定，使用你提供的 `.jpg` 素材。**檔名全部使用小寫**，GitHub Pages 會區分大小寫。

| 用途 | 路徑 |
| --- | --- |
| 鎖定桌布 | `photo/lockscreen.jpg` |
| 主畫面桌布 | `photo/homescreen.jpg` |
| 成員 Instagram、KakaoTalk 頭貼 | `photo/ins/profile/yeji.jpg` 等 |
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
- `members`：成員的顯示名稱、帳號、對應詢問者。
- `initialMessages`：新存檔的開場訊息。範例可修改或清空陣列。
- `incomingMessages`：遊戲開啟後排程的主動來訊，預設留空。
- `keywordRules`：KakaoTalk 與 Instagram 的關鍵字規則，預設兩者皆為空陣列，不會產生自由文字 AI 回覆。
- `photoEvents.scripts`：你發照片後，成員的私訊、她的貼文文案，以及另一位成員的詢問內容。
- `weather`：固定天氣快照與來源。

開場資料、排程、初始限動只在建立新存檔時套用。修改後可到「設定 → 重新開始」套用新的初始資料；此操作需再次確認，並會清除目前瀏覽器的進度。照片事件台詞和關鍵字設定在重新載入頁面後即使用新的程式設定，但已完成的事件不會重播。成員來訊編輯不提供玩家端操作介面。

成員訊息可使用 `{{nickname}}`，畫面會代入玩家設定的稱呼；`{{name}}` 會代入玩家的顯示名稱。聊天紀錄不會把未替換的模板顯示給玩家。照片的隨機日期與編輯說明都會隨存檔保存，重新整理不會重新抽選。

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

從遊戲內「照片」或發文視窗的「最近項目」選擇照片，才能攜帶成員配對資料；一般從裝置上傳的任意圖片不會猜測成員身分。多圖貼文可同時觸發多位成員。由照片分享到貼文時會先帶入該照片的說明，仍可在發文前修改。

1. 你分享 A 的 `me.jpg`（貼文或限動皆可）。
2. 約 1.2 秒後，A 在 Instagram 私訊詢問。
3. 再約 3.5 秒後，A 發佈 `her.jpg` 對應貼文。
4. 再約 2.2 秒後，B 私訊詢問；只有你和 A 都發佈後才會觸發。

| 你與 A 分享照片 | 來詢問的 B |
| --- | --- |
| Yeji | Ryujin |
| Lia | Yuna |
| Ryujin | Chaeryeong |
| Chaeryeong | Lia |
| Yuna | Yeji |

每一對配圖每份存檔只觸發一次，重複分享不會重播。劇情佇列會存檔，關閉後再進入仍會依序繼續。限動觀看介面顯示 24 小時內的內容，舊資料仍保留在存檔內供劇情一致性使用。

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

測試涵蓋五組 A→B 對應、訊息／貼文順序、重複觸發、多張照片、限動、存檔恢復、非配對圖片、觀察者條件、空白及自訂關鍵字、排程來訊、未讀數與無效存檔。另驗證開局表單、稱呼代入、設定前的排程暫停、舊存檔相容性、隨機照片日期、排序、前後切換與說明保存，以及瀏覽器存檔、重新開始確認與進度清除。以最小 DOM 測試替身驗證互動接線；這些測試不取代真實瀏覽器驗證。

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
