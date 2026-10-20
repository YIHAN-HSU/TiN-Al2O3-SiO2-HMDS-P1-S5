# P1-S5 四底材分子吸附預測 — GitHub／Render 部署版

本專案沿用原有 React 介面、TiN TypeScript 與羥基化 α-Al₂O₃(0001) Python v1.2 引擎，以及既有 SiO₂／HMDS 假設模型。未更動原始公式、係數或 Model ID。SU 為未驗證的假設性情境分數，不是 ΔGads，也不得與 eV 混合排序。公開版不提供 Poor Co。

## 架構與訪客資料

單一 Docker Web Service 同時提供 React 靜態頁面、Node API、Python／RDKit，前後端同來源，不需額外 CORS 或 API URL。綁定 0.0.0.0 與 Render 指定的 PORT。

每次分析使用獨立的 SQLite :memory: 連線，完成或失敗後關閉；不讀取本機正式資料庫、不保留伺服器共用歷史。僅此瀏覽器頁面的目前結果可匯出 CSV。公開版封鎖歷史、原始整包下載、管理／文獻資料庫與 DFT 工作 API，不啟動 Advanced Server。公開原始碼包不含公司配方、歷史輸入、原始資料庫、DFT 工作、舊 Git 歷史或本機工具。Render 的平台存取紀錄仍受 Render 自身保留政策管理，應避免在 URL 放入分子內容。

支援 SMILES、InChI、MDL／SDF、四底材自由勾選、自動選模型、同表結果、2D／3D、中文介面、CSV。公開服務限制 80 個重原子／240 個原子、50,000 字元、SDF 最多 32 個分子，同時分析預設 1 筆；繁忙時回傳 429，不建立無上限佇列。超限材料請使用本機完整版本。

## 本機公開模式

需求：Node.js 24、Python 3.12 以上，以及本機可用的 RDKit 相依版本。Windows PowerShell：

~~~powershell
npm ci
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PYTHON_EXECUTABLE=(Resolve-Path .venv/Scripts/python.exe).Path
$env:PYTHONUTF8='1'
npm run build:public
$env:PUBLIC_DIST_DIR='dist-public'
$env:PORT='10000'
npm run start:public
~~~

開啟 http://localhost:10000 。原始本機完整專案仍使用原本 launch.mjs 的 3200／3201，未改動啟動方式。本公開部署快照以公開服務為範圍，npm start 啟動同一公開入口。

## Docker

~~~sh
docker build -t p1-s5-public .
docker run --rm --read-only --tmpfs /tmp p1-s5-public npm run test:public
docker run --rm --read-only --tmpfs /tmp -p 10000:10000 -e PORT=10000 p1-s5-public
~~~

本次工作站沒有 Docker Desktop／WSL，故本機 Docker 驗收為 NOT RUN；不可把 Windows 測試當成 Linux 容器通過。GitHub Actions 已實際完成 Linux build、43 項模型／公開模式回歸（0 失敗）及 HTTP 測試：[成功紀錄](https://github.com/YIHAN-HSU/TiN-Al2O3-SiO2-HMDS-P1-S5/actions/runs/39386672515)。未將 localhost 結果當成 Docker 結果。

## 目前部署狀態

GitHub Connector 寫入曾回傳 403 Resource not accessible by integration；依使用者指示改用本機 Git CLI／Git Credential Manager，已成功推送 main（首次提交 7ad8b2525ed3f18247e79a02fe36c064c9b4fb83），包含 Dockerfile 與 render.yaml。Render 尚待登入／建立 Web Service，尚無已驗證的公開 HTTPS 位址。

## GitHub 與更新

擁有者：YIHAN-HSU；Repository：TiN-Al2O3-SiO2-HMDS-P1-S5。依使用者最新指示使用 Public。

僅使用本次乾淨的部署快照上傳，不要把原本工作站的 .git、資料庫或歷史 ZIP 推送。新專案可執行 git init -b main、git add 明確檔案、git commit，再設定遠端並推送。已提供 GitHub Actions（contents: read，無部署金鑰）。日後先在測試分支驗證／發 PR，CI 通過後再合併 main。

## Render 建立 Web Service

1. 登入 https://dashboard.render.com ，若尚未註冊，由使用者完成帳號／條款。
2. 可透過 New → Blueprint 選此 Repository 套用 render.yaml；或 New → Web Service → GitHub 選此 Repository。
3. 分支 main；Runtime Docker；Dockerfile ./Dockerfile；Context .；Region Singapore；Health Check /healthz。
4. 初始 plan 為 free，沒有設定付費磁碟。免費資源可能休眠且受記憶體／運算限制；公開負載測試後再決定是否升級，並由使用者同意費用。
5. Auto Deploy 設 After CI Checks Pass（render.yaml：autoDeployTrigger: checksPass）。若 GitHub App 尚未安裝／尚未授權此 Repository，由使用者授權。
6. Render 會提供 HTTPS 位址。必須實際驗證該位址、重新部署及多訪客操作，才能把 Render 標為 PASS；目前詳見 DEPLOYMENT_TEST_REPORT.md。

| 環境變數 | 值／預設 | 說明 |
|---|---|---|
| PORT | Render 指定；本機 10000 | 不固定為 3200 |
| S5_PUBLIC_MODE | 1 | 禁止無請求範圍的共用 SQLite |
| PUBLIC_DIST_DIR | dist（Docker）／dist-public（本機） | 公開建置產物 |
| PUBLIC_MAX_CONCURRENCY | 1 | 允許 1–2；依資源驗收後調整 |
| PYTHON_EXECUTABLE | python（Docker）／Windows .venv 絕對路徑 | 指向 RDKit 環境 |
| PYTHONUTF8 | 1 | 中文與 JSON 編碼 |
| PYTHONDONTWRITEBYTECODE | 1 | 不寫入 Python 快取 |
| OMP_NUM_THREADS／OPENBLAS_NUM_THREADS／MKL_NUM_THREADS | 1 | 容器運算資源限制 |

不需要 Gemini、GitHub、Render API Key 放入網站環境。不建立持久訪客資料庫。

## 驗收與限制

npm run test:public 驗證原始值、三種格式、單選／複選、SU／eV CSV、訪客隔離。HTTP 腳本 tests/http-acceptance.ts 使用 TEST_BASE_URL，並行測試需以 PUBLIC_MAX_CONCURRENCY=2 的測試服務執行，正式預設仍為 1。

記錄詳見 DEPLOYMENT_TEST_REPORT.md。模型數值未建立新的實驗準確率，不把 SU 稱為物理 ΔGads；公開服務也不執行表面 DFT。

官方依據：[Render Docker](https://render.com/docs/docker)、[Web Services](https://render.com/docs/web-services)、[Blueprint](https://render.com/docs/blueprint-spec)、[Auto Deploy](https://render.com/docs/deploys)。
