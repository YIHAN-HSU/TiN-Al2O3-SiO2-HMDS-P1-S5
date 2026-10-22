import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {createPublicApp} from '../public-server';
import {hashPassword,verifyPassword} from '../src/auth/password';
let time=Date.now();const password=randomBytes(24).toString('base64url');
const hash=await hashPassword(password),secret=randomBytes(48).toString('base64url');
const env={NODE_ENV:'production',ADSORVIA_PASSWORD_HASH:hash,ADSORVIA_SESSION_SECRET:secret};
const checks:{name:string;status:string}[]=[];function check(name:string,ok:unknown){assert.ok(ok,name);checks.push({name,status:'PASS'});}
async function host(settings:NodeJS.ProcessEnv){const app=createPublicApp({env:settings,now:()=>time});const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));return {server,base:'http://127.0.0.1:'+(server.address() as AddressInfo).port};}
const main=await host(env);const open=[main.server];
async function request(route:string,options:any={}){const {cookie,csrf,origin,...init}=options;return fetch(main.base+route,{redirect:'manual',...init,headers:{...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-Adsorvia-CSRF':csrf}:{}),...(init.method==='POST'?{'Content-Type':'application/json',Origin:origin||main.base.replace('http:','https:')}:{}) ,...init.headers}});}
const cookie=(r:Response)=>r.headers.getSetCookie()[0]?.split(';')[0]||'';
async function session(){const r=await request('/auth/session');return {cookie:cookie(r),state:await r.json()};}
async function login(s:Awaited<ReturnType<typeof session>>,value:unknown=password){return request('/auth/login',{method:'POST',cookie:s.cookie,csrf:s.state.csrf_token,body:JSON.stringify({password:value})});}
try{
 check('scrypt verifies correct password',await verifyPassword(password,hash));
 check('scrypt rejects incorrect password',!await verifyPassword(randomBytes(24).toString('hex'),hash));
 check('malformed / weak hash rejected',!await verifyPassword(password,hash.replace('32768','1024')));
 const dist=path.resolve(process.env.PUBLIC_DIST_DIR||'dist');
 const builtHtml=fs.readFileSync(path.join(dist,'index.html'),'utf8');
 const bundle=builtHtml.match(/<script[^>]+src="([^"]+)"/)?.[1];assert.ok(bundle,'Built application entry asset');
 check('authenticated manifest requests credentials',builtHtml.includes('crossorigin="use-credentials"'));
 const textFiles=[path.join(dist,'index.html'),...fs.readdirSync(path.join(dist,'assets')).filter(n=>/\.(js|css|map)$/.test(n)).map(n=>path.join(dist,'assets',n))];
 check('runtime test credentials never enter frontend build',textFiles.every(file=>{const text=fs.readFileSync(file,'utf8');return ![password,hash,secret,'ADSORVIA_PASSWORD_HASH','ADSORVIA_SESSION_SECRET'].some(value=>text.includes(value));}));
 check('homepage requires login',(await request('/')).status===303);
 const loginPage=await request('/login'),html=await loginPage.text();check('only branded Secure Access page',loginPage.status===200&&html.includes('Secure Access')&&html.includes('Adsorvia')&&!html.includes('四底材整合結果'));
 check('login CSP',loginPage.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
 for(const route of ['/api/analyze','/api/public-config','/api/history','/api/download-zip','/api/s4/jobs','/api/parse-sdf-options'])check('unauthenticated API 401 '+route,(await request(route,{method:'POST',body:'{}'})).status===401);
 check('GET API 401',(await request('/api/history')).status===401);
 check('OPTIONS does not bypass API gate',(await request('/api/analyze',{method:'OPTIONS'})).status===401);
 check('query auth bypass rejected',(await request('/api/analyze?auth=false&bypass=1',{method:'POST',body:'{}',headers:{'X-Adsorvia-Bypass':'true'}})).status===401);
 check('platform assets protected',(await request('/assets/not-a-login-bundle.js')).status===303);
 check('real built platform JavaScript requires login',(await request(bundle!)).status===303);
 check('source / data path protected',(await request('/backend/rdkit_engine_v12.py')).status===303);
 check('public logo allowed',(await request('/auth-assets/logo.png')).status===200);
 const s=await session();check('preauth not authenticated',s.state.authenticated===false);
 check('login requires CSRF',(await request('/auth/login',{method:'POST',cookie:s.cookie,body:JSON.stringify({password})})).status===403);
 check('cross-site login rejected',(await request('/auth/login',{method:'POST',cookie:s.cookie,csrf:s.state.csrf_token,origin:'https://unrelated.example',body:JSON.stringify({password})})).status===403);
 const wrong=randomBytes(20).toString('hex'),bad=await login(s,wrong),badText=await bad.text();check('wrong password rejected',bad.status===401);
 check('responses do not disclose credentials',![wrong,password,hash,secret].some(x=>badText.includes(x)||html.includes(x)));
 const good=await login(s),goodState=await good.json(),authCookie=cookie(good),setCookie=good.headers.getSetCookie()[0];
 check('correct password logs in',good.status===200&&goodState.authenticated);
 check('Secure HttpOnly SameSite Strict host-only cookie',setCookie.includes('__Host-adsorvia_session=')&&setCookie.includes('Secure')&&setCookie.includes('HttpOnly')&&setCookie.includes('SameSite=Strict')&&setCookie.includes('Path=/')&&!setCookie.includes('Domain='));
 check('session rotated on login',authCookie!==s.cookie&&goodState.csrf_token!==s.state.csrf_token);
 check('old anonymous cookie cannot become authenticated',(await request('/api/public-config',{cookie:s.cookie})).status===401);
 const refresh=await request('/auth/session',{cookie:authCookie});check('refresh retains session',(await refresh.json()).authenticated===true);
 check('authenticated app available',(await request('/',{cookie:authCookie})).status===200);
 check('protected HTML is not cached',(await request('/',{cookie:authCookie})).headers.get('cache-control')==='no-store');
 const protectedBundle=await request(bundle!,{cookie:authCookie});check('authenticated platform asset available and not cached',protectedBundle.status===200&&protectedBundle.headers.get('cache-control')==='no-store');
 check('no-store on protected response',(await request('/api/public-config',{cookie:authCookie})).headers.get('cache-control')==='no-store');
 check('tampered cookie rejected',(await request('/api/public-config',{cookie:authCookie.slice(0,-1)+(authCookie.endsWith('a')?'b':'a')})).status===401);
 check('calculation requires CSRF',(await request('/api/analyze',{method:'POST',cookie:authCookie,body:'{}'})).status===403);
 check('cross-site calculation rejected',(await request('/api/analyze',{method:'POST',cookie:authCookie,csrf:goodState.csrf_token,origin:'https://unrelated.example',body:'{}'})).status===403);
 const result=await request('/api/analyze',{method:'POST',cookie:authCookie,csrf:goodState.csrf_token,body:JSON.stringify({input_type:'SMILES',raw_text:'CCO',substrates:['TiN','Al2O3','SiO2','HMDS_SiO2']})});
 const data=await result.json();check('authenticated original four-substrate prediction',result.status===200&&data.prediction?.raw_predicted_eads_ev===-.8049139562000001&&data.al2o3?.raw_predicted_eads_ev===-.6&&data.integrated_results?.rows.length===4&&data.integrated_results.rows.every((r:any)=>Number.isFinite(r.final.value)));
 check('logout requires CSRF',(await request('/auth/logout',{method:'POST',cookie:authCookie})).status===403);
 const out=await request('/auth/logout',{method:'POST',cookie:authCookie,csrf:goodState.csrf_token});check('logout clears cookie',out.status===200&&out.headers.getSetCookie()[0].includes('Expires=Thu, 01 Jan 1970'));
 check('stolen cookie replay rejected after logout',(await request('/api/public-config',{cookie:authCookie})).status===401);
 time+=16*60*1000;const idleSession=await session(),idleLogin=await login(idleSession),idleCookie=cookie(idleLogin);
 time+=29*60*1000;check('session valid before idle expiry',(await (await request('/auth/session',{cookie:idleCookie})).json()).authenticated);
 time+=2*60*1000;check('status polling does not extend idle expiry',(await request('/api/public-config',{cookie:idleCookie})).status===401);
 const absSession=await session(),absLogin=await login(absSession),absCookie=cookie(absLogin);
 for(let i=0;i<23;i++){time+=20*60*1000;assert.equal((await request('/api/public-config',{cookie:absCookie})).status,200);}
 time+=21*60*1000;check('absolute eight-hour expiry enforced',(await request('/api/public-config',{cookie:absCookie})).status===401);
 time+=16*60*1000;const limited=await session();for(let i=0;i<5;i++)assert.equal((await login(limited,{})).status,401);
 const rate=await login(limited,{});check('five attempts per 15 minutes',rate.status===429&&rate.headers.get('retry-after')==='900');
 check('forged forwarded IP cannot bypass local limit',(await request('/auth/login',{method:'POST',cookie:limited.cookie,csrf:limited.state.csrf_token,body:'{}',headers:{'X-Forwarded-For':'192.0.2.234'}})).status===429);
 time+=16*60*1000;const liveSession=await session(),liveLogin=await login(liveSession),liveCookie=cookie(liveLogin);
 check('restart test starts with a live session',(await request('/api/public-config',{cookie:liveCookie})).status===200);
 const restart=await host(env);open.push(restart.server);check('container restart invalidates live old session',(await fetch(restart.base+'/api/public-config',{headers:{Cookie:liveCookie}})).status===401);
 const proxy=await host({...env,RENDER:'true'});open.push(proxy.server);
 const preProxy=await fetch(proxy.base+'/auth/session'),proxyState=await preProxy.json(),proxyCookie=cookie(preProxy);
 for(let i=0;i<50;i++)assert.equal((await fetch(proxy.base+'/auth/login',{method:'POST',headers:{Cookie:proxyCookie,'X-Adsorvia-CSRF':proxyState.csrf_token,'X-Forwarded-For':'192.0.2.'+(i+1),Origin:proxy.base.replace('http:','https:'),'Content-Type':'application/json'},body:'{}'})).status,401);
 check('global login cap survives distributed / forwarded IP changes',(await fetch(proxy.base+'/auth/login',{method:'POST',headers:{Cookie:proxyCookie,'X-Adsorvia-CSRF':proxyState.csrf_token,'X-Forwarded-For':'192.0.2.201',Origin:proxy.base.replace('http:','https:'),'Content-Type':'application/json'},body:'{}'})).status===429);
 for(const settings of [{NODE_ENV:'production'},{...env,ADSORVIA_PASSWORD_HASH:'invalid'},{...env,ADSORVIA_SESSION_SECRET:'short'},{NODE_ENV:'development',RENDER:'true',ADSORVIA_AUTH_DISABLED:'true'}]){
  const missing=await host(settings);open.push(missing.server);
  check('fail closed without valid production configuration',(await fetch(missing.base+'/api/analyze',{method:'POST',body:'{}'})).status===503&&(await fetch(missing.base+'/healthz')).status===503);
 }
 console.log(JSON.stringify({passed:checks.length,failed:0,checks},null,2));
}finally{for(const server of open){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}}
