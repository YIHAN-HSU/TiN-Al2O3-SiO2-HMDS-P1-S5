import express from 'express';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validPasswordHash,verifyPassword} from './password';

const IDLE_MS=30*60*1000,ABSOLUTE_MS=8*60*60*1000,PREAUTH_MS=15*60*1000;
type Session={authenticated:boolean;csrf:string;created:number;lastSeen:number};
// Clock/environment injection is internal test composition, never an HTTP/env auth bypass.
export type AuthOptions={env?:NodeJS.ProcessEnv;now?:()=>number};
export function createAccessControl(options:AuthOptions={}){
 const env=options.env||process.env,now=options.now||Date.now;
 const production=env.NODE_ENV==='production'||!!env.RENDER;
 const encoded=env.ADSORVIA_PASSWORD_HASH||'',secret=env.ADSORVIA_SESSION_SECRET||'';
 const configured=validPasswordHash(encoded)&&/^[A-Za-z0-9_-]{43,128}$/.test(secret)&&Buffer.from(secret,'base64url').length>=32;
 const cookieName=production?'__Host-adsorvia_session':'adsorvia_session';
 const cookieOptions={httpOnly:true,secure:production,sameSite:'strict' as const,path:'/'};
 const sessions=new Map<string,Session>(),attempts=new Map<string,{count:number;until:number}>();
 let verifying=false;
 const sign=(id:string)=>createHmac('sha256',secret).update(id).digest('base64url');
 const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const expires=(s:Session)=>s.authenticated?Math.min(s.created+ABSOLUTE_MS,s.lastSeen+IDLE_MS):s.created+PREAUTH_MS;
 function clean(){for(const [key,s] of sessions)if(expires(s)<=now())sessions.delete(key);for(const [key,a] of attempts)if(a.until<=now())attempts.delete(key);}
 function read(req:express.Request){
  const values=(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));
  if(values.length!==1)return null;
  const value=values[0].slice(cookieName.length+1),parts=value.split('.');
  if(parts.length!==2||!/^[A-Za-z0-9_-]{43}$/.test(parts[0])||!/^[A-Za-z0-9_-]{43}$/.test(parts[1])||!equal(parts[1],sign(parts[0])))return null;
  const session=sessions.get(parts[0]);
  if(!session)return null;
  if(expires(session)<=now()){sessions.delete(parts[0]);return null;}
  return {id:parts[0],session};
 }
 function issue(res:express.Response,authenticated:boolean){
  clean();if(sessions.size>=2000)return null;
  const id=randomBytes(32).toString('base64url');
  const session={authenticated,csrf:randomBytes(32).toString('base64url'),created:now(),lastSeen:now()};sessions.set(id,session);
  res.cookie(cookieName,id+'.'+sign(id),{...cookieOptions,maxAge:authenticated?ABSOLUTE_MS:PREAUTH_MS});
  return {id,session};
 }
 function limit(key:string,max:number,windowMs:number){
  const existing=attempts.get(key);if(existing&&existing.until>now()){existing.count++;return existing.count<=max;}
  clean();if(attempts.size>=2500)return false;attempts.set(key,{count:1,until:now()+windowMs});return true;
 }
 function unavailable(res:express.Response){return res.status(503).json({error:'安全存取尚未完成設定，請聯絡管理者。',code:'ACCESS_NOT_CONFIGURED'});}
 function originOK(req:express.Request){
  if(req.get('sec-fetch-site')==='cross-site')return false;
  const expected=(production?'https://':'http://')+req.get('host');
  return req.get('origin')===expected;
 }
 function csrfOK(req:express.Request,s:Session){const token=req.get('x-adsorvia-csrf')||'';return /^[A-Za-z0-9_-]{43}$/.test(token)&&equal(token,s.csrf)&&originOK(req);}
 const router=express.Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/auth/session',(req,res)=>{
  if(!configured)return unavailable(res);
  let current=read(req);
  if(!current){
   if(!limit('session-global',300,60000)||!limit('session:'+req.ip,30,60000))return res.status(429).set('Retry-After','60').json({error:'請稍後再試。'});
   current=issue(res,false);
  }
  if(!current)return res.status(503).json({error:'登入服務忙碌中，請稍後再試。'});
  res.json({authenticated:current.session.authenticated,csrf_token:current.session.csrf,expires_at:expires(current.session)});
 });
 router.post('/auth/login',express.json({limit:'4kb'}),async(req,res)=>{
  if(!configured)return unavailable(res);
  const current=read(req);
  if(!current||!csrfOK(req,current.session))return res.status(403).json({error:'登入頁面已過期，請重新整理。',code:'CSRF_REJECTED'});
  if(!req.is('application/json'))return res.status(415).json({error:'不支援的請求格式。'});
  if(!limit('login-global',50,PREAUTH_MS)||!limit('login:'+req.ip,5,PREAUTH_MS))return res.status(429).set('Retry-After','900').json({error:'登入嘗試過於頻繁，請 15 分鐘後再試。',code:'LOGIN_RATE_LIMITED'});
  if(verifying)return res.status(429).set('Retry-After','2').json({error:'登入服務忙碌中，請稍後再試。'});
  verifying=true;
  try{
   if(!await verifyPassword(req.body?.password,encoded))return res.status(401).json({error:'密碼錯誤，請重試。',code:'INVALID_PASSWORD'});
   sessions.delete(current.id);const fresh=issue(res,true);
   if(!fresh)return res.status(503).json({error:'登入服務忙碌中，請稍後再試。'});
   res.json({authenticated:true,csrf_token:fresh.session.csrf,expires_at:expires(fresh.session)});
  }catch{res.status(503).json({error:'登入服務暫時無法使用。'});}finally{verifying=false;}
 });
 router.post('/auth/logout',(req,res)=>{
  if(!configured)return unavailable(res);
  const current=read(req);if(!current?.session.authenticated)return res.status(401).json({error:'請先登入。',code:'AUTH_REQUIRED'});
  if(!csrfOK(req,current.session))return res.status(403).json({error:'安全驗證失敗，請重新整理。',code:'CSRF_REJECTED'});
  sessions.delete(current.id);res.clearCookie(cookieName,cookieOptions);res.json({authenticated:false});
 });
 const files:Record<string,{file:string;type:string}>={
  '/auth-assets/logo.png':{file:'../assets/branding/adsorvia-logo.png',type:'image/png'},
  '/auth-assets/favicon.ico':{file:'../assets/branding/favicon.ico',type:'image/x-icon'},
  '/auth-assets/login.js':{file:'./login.js',type:'application/javascript'},
  '/auth-assets/login.css':{file:'./login.css',type:'text/css'},
 };
 for(const [route,file] of Object.entries(files))router.get(route,(_req,res)=>res.type(file.type).send(readFileSync(new URL(file.file,import.meta.url))));
 router.get('/login',(req,res)=>{
  if(!configured)return res.status(503).type('html').send('<!doctype html><html lang="zh-Hant"><title>Adsorvia | Secure Access</title><h1>Adsorvia</h1><p>安全存取尚未完成設定，請聯絡管理者。</p></html>');
  if(read(req)?.session.authenticated)return res.redirect(303,'/');
  res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.type('html').send(readFileSync(new URL('./login.html',import.meta.url)));
 });
 const protect:express.RequestHandler=(req,res,next)=>{
  if(!configured)return unavailable(res);
  const current=read(req);
  if(!current?.session.authenticated){
   if(/^\/api(?:\/|$)/i.test(req.path))return res.status(401).json({error:'請先登入 Adsorvia。',code:'AUTH_REQUIRED'});
   return res.redirect(303,'/login');
  }
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!csrfOK(req,current.session))return res.status(403).json({error:'安全驗證失敗，請重新登入。',code:'CSRF_REJECTED'});
  current.session.lastSeen=now();res.set('X-Adsorvia-Session-Expires',String(expires(current.session)));next();
 };
 return {router,protect,configured};
}
