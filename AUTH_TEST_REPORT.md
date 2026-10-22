# Adsorvia P1-S5 密碼登入保護 — 第一階段驗收

> 第二階段更新（2026-10-22）：使用者已確認 Render 兩個必要環境變數以 Save only 設定完成，未提供或讀取任何值。本機 build、TypeScript、43 項公開模型、63 項原始 TS、60 項 Python、250 項 SU、54 項安全測試及 31 項已登入 HTTP 驗收已重新通過。101 個既有檔案與備份位元組一致，兩個 SQLite 檔案未寫入。本機 HTTP 初次受沙箱 EACCES 阻擋，取得執行授權後重跑通過，未修改計算或預期值。Docker CI 另在測試分支驗收，通過後才更新 main；Render 指定 Commit Live 與公開 HTTPS 保護另行確認。以下為第一階段的歷史驗收紀錄，未執行的項目不代表第二階段已通過。

日期：2026-10-21（Asia/Taipei）。只在 deployment/github-ready 修改正式部署來源。原始主專案的 3200 / 3201 開發流程、P1-S4 與更早版本未修改。

## 目前狀態

- 本機開發、建置、可執行回歸及瀏覽器驗收完成。安全回歸 54 項、公開模型 43 項、HTTP 31 項、原始 TS 63 項、Python 60 項、SU 250 項均 PASS。
- Docker：NOT RUN。本機沒有 Docker 引擎；WSL launcher 存在但子系統未安裝。沒有安裝 Docker / WSL，也沒有變更系統虛擬化設定。
- 新 GitHub Actions：NOT RUN。測試流程已更新，但依第一階段要求沒有 Commit / Push，所以不得沿用上一個 Commit 的成功 CI 當成本次通過。
- 正式 Render 環境變數：等待使用者自行設定並確認；未讀取、修改或記錄正式值。
- 新 Commit：尚未建立；基準仍為 3cc93dc770665c0aeb834b3860f7ba2d5e960098。沒有 Push、沒有觸發 Render 部署。
- Render 新版本 Live：NOT DEPLOYED / NOT VERIFIED。既有公開網址 https://tin-al2o3-sio2-hmds-p1-s5.onrender.com 不變；不能宣稱現有公開網站已受本次登入保護。

## 修改檔案清單

### 新增

- src/auth/password.ts：固定安全參數的 Node scrypt 雜湊／驗證，salt 及 timingSafeEqual。
- src/auth/server.ts：伺服器 Session、Cookie、CSRF、限流、授權中介層與最小公開路由。
- src/auth/login.html、login.css、login.js：Adsorvia 深藍／青藍登入頁、顯示／隱藏密碼、錯誤提示。
- src/auth/client.tsx：Session 啟動驗證、逾時導回、記憶體 CSRF、授權 fetch、Logout。
- scripts/generate-auth-secrets.ts：Windows 使用者自行隱藏輸入密碼；只複製雜湊／隨機 Secret 到本機剪貼簿，拒絕非互動輸入，不建立憑證檔。
- tests/auth-regression.ts：54 項伺服器／安全驗收，使用執行時隨機憑證。
- tests/secure-http-runner.ts：自動啟動隔離正式模式服務、登入、執行既有 HTTP 測試並清理。
- AUTH_ACCESS.md：憑證產生、Render 設定、架構、限制、Windows 與 Docker 測試指令。
- AUTH_TEST_REPORT.md：本報告。

### 修改既有檔案

- public-server.ts：在既有計算路由前加入授權；保留原處理函式與成功回應格式；healthz 對未設定安全值回傳 503。
- src/App.tsx：只加入 authFetch 及 Logout；原計算／結果邏輯不變。
- src/main.tsx：正式版以 SessionBoundary 包住原 App。本機非 public 的前端流程不要求網站密碼。
- index.html：只為既有 manifest 增加 crossorigin=use-credentials，使登入後圖示設定能攜帶 Cookie；標題與品牌內容不變。
- package.json：新增安全測試與使用者憑證產生命令；無新增依賴。
- tsconfig.json：新增測試／工具型別檢查。
- tests/http-acceptance.ts：使用測試 Session / CSRF，原有格式與四底材驗收仍執行。
- .github/workflows/public-deployment.yml：保留原 Docker build，加上 TypeScript、安全回歸與已登入 HTTP 驗收。
- .dockerignore：僅將新增測試／安全工具納入既有容器來源白名單。Dockerfile 本身不變。
- .env.example：只有兩個空白變數名稱，沒有值。
- .gitignore：允許兩份安全文件；仍排除私密環境檔與資料庫。
- README.md：連結安全設定說明與階段限制。

## 登入架構

參見 AUTH_ACCESS.md。密碼使用 Node 內建 scrypt N=32768 / r=8 / p=3（OWASP 列出的 32 MiB 組合）；無固定密碼、無外部驗證繞過參數。

正式 Cookie 為 __Host-adsorvia_session，HttpOnly / Secure / SameSite=Strict / Path=/，沒有 Domain。Session ID 隨機產生並簽章，伺服器記憶體保存與撤銷。最長 8 小時、閒置 30 分鐘；登入旋轉 ID / CSRF；登出立即失效；重啟清空 Session。

登入及所有不安全方法都驗證 Origin 與 CSRF Token。單 IP 15 分鐘 5 次、全站 50 次登入上限，一次只允許一個雜湊驗證。分散／偽造 IP 的測試也被全站上限擋下。

/login、/auth/session、登入／登出處理與固定的登入品牌素材為必要公開入口；/healthz 只回傳無資料的健康狀態。計算、查詢、匯出、下載與真正建置出的平台 JavaScript 都位於授權檢查之後。只有登入頁及其必要素材可在未登入時載入。未知或未提供的 API 於登入後仍維持原 404。

受保護 HTML / 資產 / API 都是 no-store；前端逾時、401、頁面重新顯示會重新檢查 Session。CSV 資料仍保留原 eV / SU 及驗證標記。

Render Free 的冷啟動或重新部署會要求重新登入；記憶體 Session / 限流不跨實例持久保存。此設計適用現有單實例服務，不新增帳號、資料庫或付費資源。

## 指定驗收結果

|項目|狀態|證據|
|---|---|---|
|未登入只看到 Secure Access|PASS|瀏覽器與 GET / 303 → /login|
|未登入計算／查詢／下載 API|PASS|401；POST /api/analyze 與其他入口皆檢查|
|錯誤密碼|PASS|401，瀏覽器顯示密碼錯誤|
|正確密碼|PASS|伺服器與瀏覽器登入成功|
|登入後四底材計算|PASS|CCO 原值與 SU 均有效|
|重新整理維持 Session|PASS|瀏覽器刷新保留登入|
|登出及 Cookie 重播|PASS|API 再次 401，舊 Cookie 無效|
|閒置／絕對過期|PASS|以內部注入時鐘測試 30 分鐘與 8 小時，不提供 HTTP / env 時鐘入口|
|登入頻率限制|PASS|每 IP、全站、Retry-After、偽造 IP|
|憑證未進入前端／原始碼／回應|PASS|隨機執行時憑證精確比對、原始碼掃描；未使用正式憑證|
|TypeScript / public build|PASS|tsc --noEmit；Vite 成功，僅保留原有大型 bundle 提示|
|既有已登入 HTTP 驗收|PASS|31 項：3 格式、15 組底材選擇、並行／隔離、錯誤／SDF|
|Docker / 新 GitHub Actions|NOT RUN|環境及第一階段禁止推送限制，沒有偽報通過|
|六組原始 Eads|PASS|public 43 + 原始 TS 63 / Python 60|
|SiO₂ / HMDS 原始 SU|PASS|既有 hypothetical 測試 250 項，未改權重／預期值|
|原始 API 回應／CSV 單位|PASS|既有公開模式與 HTTP 測試|
|Logo、Favicon、品牌與版本|PASS|與基準檔位元組一致；瀏覽器保留|

### 六組 Eads 比對

每組修改前、修改後完全相同，差值為 0；沒有為顯示四捨五入而修改儲存精度。

|SMILES|TiN Eads (eV)|Al₂O₃ Eads (eV)|
|---|---|---|
|CCO|-0.8049139562000001|-0.6|
|COCCO|-1.0280412393999998|-0.8|
|CC(=O)O|-1.030309693|-1.06|
|CCOC(=O)C|-0.6726228366|-0.91|
|c1ccccc1|-0.5446305766|-0.45|
|C=COCCOCCOC=C|-1.1806647579999998|-1.03|

瀏覽器乙醇結果：SiO₂ -1.4514 SU、HMDS -0.9844 SU（僅畫面四位顯示）；原模型 JSON 及 Python 程式完全相同。

## 範圍、備份與證據

- 修改前 Git 為乾淨的 3cc93dc，完整受追蹤來源備份在主專案 deployment-audit/auth/before-3cc93dc.zip。
- scope.json 比對此 ZIP：101 個既有檔案位元組完全不變。包含 TiN / Al₂O₃ / SiO₂ / HMDS 引擎、係數、分子解析、SQLite 程式與結構、品牌圖檔、Dockerfile、render.yaml、依賴鎖定等。
- 兩個既有 SQLite 檔案沒有在備份建立後寫入；測試使用記憶體 DB，原始測試報告也隔離到 deployment-audit/auth。
- 全部測試使用隨機測試密碼 / Secret，不使用 Render 正式值。瀏覽器驗收的暫存測試密碼檔已刪除，從未納入 Git 或報告。伺服器不記錄輸入密碼。
- browser-results.json、login.png、wrong-password.png、authenticated-results.png、logged-out-api.png 保留實際瀏覽器證據。登入後平台未觀察到新增 Console Error。
- build.log、typecheck.log、auth-regression.log、public-regression.log、secure-http.log、original-ts.log、python-regression.log、su-regression.log、scope.json 在主專案 deployment-audit/auth；不會上傳測試輸出或私有資料。

## 尚未完成與下一步

1. 使用者依 AUTH_ACCESS.md 自行產生並在既有 Render 設定兩個變數，只回覆已完成，不提供值。設定變數本身不會讓舊版網站自動具備登入保護。
2. 必須補跑本次 Docker 測試；沒有 Docker / CI 的本次結果，不得以過往版本 PASS 代替。
3. 使用者確認後才可進行第二階段 Commit / Push；所有必要驗收通過後，沿用原 main 與 Render 自動部署，不建立新服務。
4. 需確認指定 Commit Live，再實測既有 HTTPS 網址未登入 API 401、使用者自行登入後模型正常。此項目前 NOT RUN。

參考：[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)、[Node 24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)、[MDN protected manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest#deploying_a_manifest)。
