# Adsorvia P1-S5 — 共用密碼存取保護

## 第一階段與正式部署

使用者已於 2026-10-22 確認在既有 Render 服務以 Save only 設定兩個必要環境變數；開發者不讀取其值。原網址維持 https://tin-al2o3-sio2-hmds-p1-s5.onrender.com 。第二階段先以同一 Repository 的測試分支執行 Docker CI，全部通過才更新 main。不得以本機通過或舊 Commit 的 CI 代替本次容器與 Render Live 驗收。

## Windows：安全產生憑證

請在自己的互動式 PowerShell / Windows Terminal 開啟本資料夾（deployment/github-ready），使用已安裝的 Node.js：

```powershell
npm run auth:hash
```

程式要求輸入及確認至少 16 字元密碼，每個字元顯示一個星號，Backspace 同步刪除星號。只將密碼雜湊複製到本機剪貼簿，不輸出到終端、報告或檔案。立即貼到 Render 的 ADSORVIA_PASSWORD_HASH 欄位，清除剪貼簿後繼續：

```powershell
powershell.exe -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear()"
npm run auth:secret
```

將新產生並複製到剪貼簿的 Secret 貼到 ADSORVIA_SESSION_SECRET，再使用上述 Clipboard.Clear() 命令清理。Windows PowerShell 5.1 不應使用 Set-Clipboard 的空字串寫入來清除，否則可能出現參數 text 為 null 的例外。不要將任何值貼到聊天、Git、.env.example、截圖、CI 設定或報告。不要把密碼放在命令列參數中。若 Windows 開啟剪貼簿歷程／跨裝置同步，也請清除該筆紀錄；正式密碼本身不會複製到剪貼簿。可使用密碼管理工具保存你選擇的正式密碼。

若自己的終端找不到 npm / node，可使用目前 Codex 已安裝的 Node（先切換到 deployment/github-ready）：

```powershell
& 'C:\Users\yihan.hsu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import tsx scripts/generate-auth-secrets.ts hash
& 'C:\Users\yihan.hsu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import tsx scripts/generate-auth-secrets.ts session
```

請先把 hash 貼入 Render 再執行 session，避免後者覆蓋剪貼簿。

兩個命令只在使用者自己的互動式 Windows 終端執行；重新導向輸入／輸出會拒絕執行。開發者不會代為產生或記錄正式值。

## Render 設定（使用者自行執行）

1. 登入既有服務 tin-al2o3-sio2-hmds-p1-s5 → Environment。
2. 新增 ADSORVIA_PASSWORD_HASH、ADSORVIA_SESSION_SECRET，依上述方式貼入各自欄位。兩欄均必填；不得使用示例或空值。
3. 使用 Save only（若 Dashboard 提供此選項），暫不部署新程式。若儲存觸發既有版本重新部署，並不代表登入保護已上線。不要改其他環境變數、服務名稱、網址或 GitHub 連接。
4. 只回覆「兩個環境變數已設定完成」，不要提供值。
5. 第二階段完成必要 Docker / CI 驗證後才 Commit / Push；確認 Render 最新 Commit Live，再驗證公開網址。

|環境變數|用途|必要條件|
|---|---|---|
|ADSORVIA_PASSWORD_HASH|單一共用密碼的 scrypt 雜湊|由 auth:hash 產生，固定安全參數格式|
|ADSORVIA_SESSION_SECRET|Cookie Session ID 簽章|由 auth:secret 產生的 48 隨機 bytes，base64url 編碼|

沒有固定預設密碼或停用驗證的環境變數。Render / production 模式會使用 Secure Cookie；即使把 NODE_ENV 改成 development，只要 Render 標記存在，也不會降級 Cookie。缺少／格式錯誤的變數時，登入、平台及 API 回傳 503，healthz 也回傳 503；不會退回公開模式。

## 架構與限制

- scrypt N=32768、r=8、p=3（約 32 MiB，64 MiB 執行上限）、16-byte 隨機 salt、32-byte derived key，使用 timingSafeEqual。採 Node 內建實作，避免引入 Argon2 原生依賴；此參數組合列於 [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)。
- 伺服器記憶體儲存 opaque session；ID 為 32-byte 隨機值，HMAC-SHA256 簽章。登入旋轉 ID 與 CSRF Token，登出立即刪除；舊 Cookie 不能重播。
- Session 最長 8 小時，閒置 30 分鐘。狀態查詢不延長閒置期限；分析等受保護請求才更新活動時間。重新整理會保持有效 Session。
- 正式 Cookie：__Host-adsorvia_session；HttpOnly、Secure、SameSite=Strict、Path=/、無 Domain。本機 HTTP 隔離測試使用非 Secure 的不同名稱 Cookie；本機設定不會在 Render 生效。
- CSRF 使用記憶體 synchronizer token + X-Adsorvia-CSRF + 精確同源 Origin 檢查；登入也有 CSRF 保護，禁止 cross-site Fetch。實作依循 [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)。
- 每 IP 15 分鐘最多 5 次登入嘗試，全站最多 50 次，最多 1 次雜湊同時驗證；回傳 429 / Retry-After。另有匿名 Session 建立速率與記憶體容量限制。Render 僅信任最靠近的一跳反向代理；全站上限不依賴 IP，避免偽造 X-Forwarded-For 完全繞過限制。
- Session 與限流狀態是單一程序記憶體資料，不使用 SQLite，不修改原表結構。Render Free 冷啟動、重啟、重新部署後，所有 Session 失效並需重新登入，限流計數也重置。不是跨程序持久 Session／分散式限流系統；若未來改多實例，應另評估共享 Session 與限流儲存。
- 僅公開 /login、/auth/session、登入請求與登入需要的明確品牌／CSS／JS 路徑，以及不含計算結果的 /healthz。其餘 API、查詢、下載與平台程式碼全部在授權中介層之後。原計算路由的成功／模型回應格式不變。
- 未登入 API 回傳 401；一般頁面／平台資產導向登入。受保護回應 Cache-Control:no-store。登入頁使用 CSP、frame-ancestors none、nosniff。
- 密碼只在登入表單與驗證呼叫的短暫記憶體中使用，不寫 localStorage / URL / 日誌。前端只持有 CSRF token；Session Cookie 不可由 JS 讀取。
- 使用單一共用密碼，沒有個別使用者帳號、個別撤權或身分稽核。訪客計算仍沿用既有 request-local memory database，不提供共用持久歷史。更改 Secret／密碼設定並重啟可撤銷全部 Session。

## 本機開發與測試

原本根專案 launch / 3200、3201 開發流程不改動，不要求網站密碼。部署用 public-server 在所有模式都必須有有效設定，沒有可用於 Render 的開發驗證繞過。純模型回歸直接呼叫函式，也不需手動登入。

```powershell
npm run test:public
npm run test:auth
npm run test:http:secure
npm run build
```

後兩個 HTTP / 安全測試會自行生成隨機測試憑證，不使用正式環境值，也不輸出雜湊、Secret、Cookie 或 CSRF token。Windows 請在自己的執行環境指定可用的 PYTHON_EXECUTABLE（既有主專案 .venv/Scripts/python.exe）；Linux Docker 已配置 Python。

Docker 可用時執行：

```powershell
docker build -t adsorvia-access-test .
docker run --rm --read-only --tmpfs /tmp adsorvia-access-test npm run test:public
docker run --rm --read-only --tmpfs /tmp adsorvia-access-test npm run test:auth
docker run --rm --read-only --tmpfs /tmp adsorvia-access-test npm run test:http:secure
```

Dockerfile 沒有改變，測試憑證只存在測試程序記憶體，這些命令不會部署 Render。GitHub Actions 使用同一組命令；第一階段未 Commit / Push，因此新版本雲端 CI 尚未執行。

## 第二階段正式驗收

確認兩個環境變數已設定 → 所有可執行測試及 Docker 驗證通過 → Commit / Push 原 main → GitHub Actions 通過 → Render 指定 Commit Live。再檢查未登入只見 Secure Access、POST /api/analyze 為 401、登入後六組 Eads / 兩個 SU 計算、刷新、登出／過期及 CSV。正式密碼由使用者在瀏覽器自行輸入；不得要求傳送正式密碼給開發者。
