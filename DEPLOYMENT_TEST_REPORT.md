# P1-S5 GitHub／Render 部署驗收

日期：2026-10-20。Repository 依使用者最新指示為 Public。

| 項目 | 結果 | 實際範圍 |
|---|---|---|
| 原始專案完整備份 | PASS | 41,703 檔案逐檔 SHA256 核對；兩個 SQLite 線上快照 integrity_check=ok |
| 原始 TiN／Al₂O₃ TS 回歸 | PASS | 63 項；指定專案 Python 環境後重跑通過 |
| 原始 Python 回歸 | PASS | 60 項；原始／整合值、構形一致 |
| 公開模式回歸 | PASS | 45 項；含兩個原 SQLite 檔案未寫入檢查 |
| 無私有資料的乾淨快照回歸 | PASS | 43 項；不含本機 SQLite、文獻資料檔、快取及 DFT 輸出仍可計算 |
| HTTP 首頁／API | PASS | 31 項；SMILES／InChI／MDL、15 組選取、多分子 SDF、並行／429、錯誤與來源限制 |
| TypeScript／React 建置 | PASS | 原工作目錄與乾淨快照型別檢查通過；公開 React 建置通過；主程式包較大為警告 |
| 桌面瀏覽器 | PASS | 1264×712；中文四底材同表、正確 eV／SU、2D／3D、CSV 實際下載 |
| 手機實機／窄視窗 | NOT RUN | 目前瀏覽器工具未提供 viewport 切換；不得以桌面驗收代替 |
| 六個模型／係數檔案雜湊 | PASS | 原 TiN 三檔、Al₂O₃ v1.2 原始 Python、SU Python 與 JSON 均逐位元組未變 |
| Git 歷史與公開快照掃描 | PASS | 原歷史 1,339 物件／1,064 blobs；未發現所掃描 Token／私密金鑰型態；648 條私有歷史路徑，因此不推送舊歷史。公開快照白名單不含 DB／客戶樣本／本機工具；機密掃描不是權利或完整無機密的法律保證 |
| 本機 Docker | NOT RUN | 未安裝可用 Docker Desktop／WSL；已提供實際 Docker CI 工作流程 |
| GitHub 原始碼上傳 | PASS（Git CLI／GCM） | Connector 仍回傳 403；改用本機 Git／GCM 成功正常推送既有 Repository main，首次提交 7ad8b2525ed3f18247e79a02fe36c064c9b4fb83；Dockerfile 已包含 |
| GitHub Actions Docker | 待確認 | 工作流程已隨 main 上傳，須依 GitHub Actions 實際結果驗收 |
| Render HTTPS | NOT RUN | Render Dashboard 顯示登入頁，尚未完成帳號授權／建站 |
| Render 重新部署／公開並行 | NOT RUN | 必須在 Render 部署成功後實際執行，不以 localhost 代替 |

## 乙醇實際 HTTP 結果

| 底材 | 數值 | 單位 |
|---|---|---|
| TiN | -0.8049139562000001 | eV |
| 羥基化 α-Al₂O₃(0001) v1.2 | -0.6 | eV |
| SiO₂ | -1.451362582482054 | SU |
| HMDS 改質 SiO₂ | -0.9843686261765175 | SU |
| HMDS − SiO₂ | 0.4669939563055364 | SU |

SU 僅為既有假設模型的內部情境分數，並非物理吸附自由能或實驗驗證結果。

## 修復紀錄

- 備份初次複製卡住：停止自己啟動的程序，以受限並行逐檔複製／SHA256 驗證，SQLite 改用線上快照。
- 沙箱通訊端拒絕，造成首次瀏覽器 timeout：在核准後於 Windows 主機啟動獨立 3240 測試服務；未停止原 3200／3201。
- 原始 TS 回歸首次找不到可執行的 python 別名：改用 .venv 實際直譯器，63 項重跑 PASS。
- HTTP 測試初版 SDF 字串跳脫錯誤：修正測試字串。
- 公開 SDF 選擇讀取空白標頭問題：使用 RDKit ForwardSDMolSupplier 保留位置敏感標頭，雙分子 SDF HTTP 重測 PASS；沒有修改 Eads 引擎。
- 公開結果原先空白官能基貢獻表：沿用同次原始分析的透明計數；沒有資料時不顯示空表。

## 修改檔案

- 新增 public-server.ts、src/public/service.ts、backend/public_worker.py：公開 API 白名單、原始引擎串接、輸入限制、SDF 格式邊界處理。
- src/db/database.ts：加入 AsyncLocalStorage 請求範圍記憶體資料庫；本機磁碟模式保留。
- src/App.tsx、src/s5/EnergyResults.tsx、src/integration/IntegratedResults.tsx、src/i18n/zhTW.ts：公開模式關閉共用歷史及本機管理入口、沿用中文結果與 Viewer，測試範例改為一般乙醇。
- package.json、tsconfig.json、scripts/build-public.mjs、tests/public-regression.ts、tests/http-acceptance.ts：公開啟動、建置與實際驗收。
- Dockerfile、render.yaml、.env.example、.gitignore、.dockerignore、.github/workflows/public-deployment.yml、README 與部署文件：容器、CI、環境設定與資料排除。

- 核對 Node 官方 Bookworm 映像後補入 libatomic1，確保將 Node 執行檔移入 Python 基底時保留所需系統函式庫；實際 Linux 容器驗收仍待 CI。

## 仍待完成

Docker Linux 建置／執行須由 CI 或安裝完成的 Docker 引擎驗證。GitHub Connector 查詢的可管理 App 安裝結果為空，且仍遭 403，但本機 Git CLI／GCM 推送已成功；不需要繼續重試該 Connector 寫入。Render 登入／建立 Web Service 與公開 URL 驗收仍需完成。免費 Render 資源的記憶體／冷啟動／多人負載未驗收；不可宣稱已正式上線。未授權任何付費方案或購買磁碟。
