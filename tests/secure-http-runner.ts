import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {hashPassword} from '../src/auth/password';
const password=randomBytes(24).toString('base64url');
const hash=await hashPassword(password),secret=randomBytes(48).toString('base64url');
const reservation=net.createServer();await new Promise<void>(r=>reservation.listen(0,'127.0.0.1',r));
const port=(reservation.address() as net.AddressInfo).port;await new Promise<void>(r=>reservation.close(()=>r()));
const base='http://127.0.0.1:'+port,origin=base.replace('http:','https:');
const child=spawn(process.execPath,['--import','tsx','public-server.ts'],{env:{...process.env,NODE_ENV:'production',PORT:String(port),PUBLIC_MAX_CONCURRENCY:'2',ADSORVIA_PASSWORD_HASH:hash,ADSORVIA_SESSION_SECRET:secret},stdio:['ignore','ignore','pipe'],windowsHide:true});
let diagnostic='';child.stderr.on('data',b=>{diagnostic=(diagnostic+b).slice(-3000);});
try{
 let healthy=false;for(let i=0;i<120;i++){
  try{healthy=(await fetch(base+'/healthz')).ok;if(healthy)break;}catch{}
  if(child.exitCode!==null)throw new Error('Isolated public server failed to start. Check Python/RDKit dependencies.');
  await new Promise(r=>setTimeout(r,250));
 }
 assert.ok(healthy,'Isolated secure service readiness');
 const pre=await fetch(base+'/auth/session'),state=await pre.json();
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:pre.headers.getSetCookie()[0].split(';')[0],'X-Adsorvia-CSRF':state.csrf_token},body:JSON.stringify({password})});
 assert.ok(login.ok,'Isolated random test credential logs in');const logged=await login.json();
 process.env.TEST_BASE_URL=base;process.env.TEST_AUTH_ORIGIN=origin;
 process.env.TEST_AUTH_COOKIE=login.headers.getSetCookie()[0].split(';')[0];process.env.TEST_AUTH_CSRF=logged.csrf_token;
 process.env.TEST_REPORT_FILE=process.env.TEST_REPORT_FILE||path.join(os.tmpdir(),'adsorvia-http-'+randomBytes(8).toString('hex')+'.json');
 await import('./http-acceptance');
}finally{
 delete process.env.TEST_AUTH_COOKIE;delete process.env.TEST_AUTH_CSRF;
 child.kill();await new Promise<void>(r=>{if(child.exitCode!==null||child.signalCode)r();else child.once('exit',()=>r());});
 // Never emit child environment, cookie, password, hash, or secret in test logs.
 diagnostic='';
}
