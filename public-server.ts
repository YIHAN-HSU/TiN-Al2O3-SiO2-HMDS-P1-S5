import express from 'express';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {publicAnalyze,PublicError,worker} from './src/public/service';
process.env.S5_PUBLIC_MODE='1';
const app=express();app.disable('x-powered-by');
const messages:Record<string,string>={INVALID_INPUT_TYPE:'請選擇 SMILES、InChI 或 MDL。',EMPTY_INPUT:'請輸入分子結構。',INPUT_TOO_LARGE:'輸入超過公開服務大小限制。',INVALID_SUBSTRATES:'請勾選一至四種底材。',INVALID_MOLECULE:'無法解析此分子，請檢查輸入格式。',MOLECULE_TOO_LARGE:'此分子超過公開服務限制（80 個重原子／240 個原子）。請使用本機版。',MOLECULAR_ANALYSIS_FAILED:'分子分析未完成，請檢查結構或稍後再試。',SCENARIO_ENGINE_FAILED:'假設模型暫時無法計算，請稍後再試。'};
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');if(req.path.startsWith('/api'))res.setHeader('Cache-Control','no-store');next();});
app.use(express.json({limit:'256kb'}));
let active=0;const maximum=Math.min(2,Math.max(1,Number(process.env.PUBLIC_MAX_CONCURRENCY)||1));
function originOK(req:express.Request){const origin=req.get('origin');return !origin||origin===('https://'+req.get('host'))||origin===('http://'+req.get('host'));}
app.get('/healthz',(_req,res)=>res.json({status:'ok',mode:'PUBLIC_EPHEMERAL',history:'DISABLED'}));
app.get('/api/public-config',(_req,res)=>res.json({public_mode:true,persistent_history:false,maximum_heavy_atoms:80}));
app.use('/api',(req,res,next)=>{if(req.method==='POST'&&!originOK(req))return res.status(403).json({error:'不允許跨網站提交分析。'});if(req.method!=='POST')return next();if(active>=maximum)return res.status(429).set('Retry-After','10').json({error:'分析服務忙碌中，請稍後重試。',code:'BUSY'});next();});
app.post('/api/analyze',async(req,res)=>{active++;try{res.json(await publicAnalyze(req.body));}catch(e){const code=e instanceof PublicError?e.code:'MOLECULAR_ANALYSIS_FAILED';res.status(e instanceof PublicError?e.status:500).json({error:messages[code]||messages.MOLECULAR_ANALYSIS_FAILED,code});}finally{active--;}});
app.post('/api/parse-sdf-options',async(req,res)=>{active++;try{const s=req.body?.sdf_text;if(typeof s!=='string'||s.length>50000||s.split('$$$$').length>33)return res.status(400).json({error:'SDF 大小或分子數超過限制（最多 32 個）。'});const parsed=await worker({action:'sdf_options',sdf_text:s});if(!parsed.options?.length)throw new Error('INVALID_SDF');res.json(parsed);}catch{res.status(422).json({error:'無法解析 SDF 分子，請檢查格式。'});}finally{active--;}});
app.use('/api',(_req,res)=>res.status(404).json({error:'公開版未提供此功能；訪客歷史紀錄不會儲存在伺服器。'}));
app.use(express.static(path.resolve(process.env.PUBLIC_DIST_DIR||'dist'),{index:false}));
app.get('*',(_req,res)=>res.sendFile(path.resolve(process.env.PUBLIC_DIST_DIR||'dist','index.html')));
app.use((err:any,_req:any,res:any,_next:any)=>res.status(err?.type==='entity.too.large'?413:400).json({error:'請求格式或大小不正確。'}));
// Fail startup before listening if Python/RDKit is missing; no guest data is involved.
execFileSync(process.env.PYTHON_EXECUTABLE||'python3',['-c','import rdkit,numpy;from rdkit import Chem;assert Chem.MolFromSmiles("CCO") is not None'],{stdio:'ignore',timeout:30000});
const port=Number(process.env.PORT)||10000;
const server=app.listen(port,'0.0.0.0',()=>console.log('P1-S5 PUBLIC listening on port '+port+'; request-local memory database; shared history disabled'));
server.requestTimeout=120000;server.headersTimeout=15000;
