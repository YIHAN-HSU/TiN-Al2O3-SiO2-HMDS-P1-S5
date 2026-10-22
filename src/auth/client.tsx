import React,{useEffect,useState} from 'react';
const PUBLIC=import.meta.env.VITE_PUBLIC_MODE==='true';
let csrf='',expiryTimer:ReturnType<typeof setTimeout>|undefined;
function returnToLogin(){csrf='';clearTimeout(expiryTimer);window.location.replace('/login');}
function expiresAt(value:number){clearTimeout(expiryTimer);if(Number.isFinite(value))expiryTimer=setTimeout(returnToLogin,Math.max(0,value-Date.now()));}
async function refreshSession(){
 const response=await window.fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw new Error('安全存取暫時無法使用，請重新整理。');
 const state=await response.json();if(!state.authenticated){returnToLogin();return false;}
 csrf=state.csrf_token;expiresAt(state.expires_at);return true;
}
export async function authFetch(input:RequestInfo|URL,init?:RequestInit){
 if(!PUBLIC)return window.fetch(input,init);
 const headers=new Headers(init?.headers);
 if(!['GET','HEAD','OPTIONS'].includes((init?.method||'GET').toUpperCase()))headers.set('X-Adsorvia-CSRF',csrf);
 const response=await window.fetch(input,{...init,headers,credentials:'same-origin'});
 if(response.status===401){returnToLogin();throw new Error('登入已過期，請重新登入。');}
 const expiry=response.headers.get('X-Adsorvia-Session-Expires');if(expiry)expiresAt(Number(expiry));
 return response;
}
export function SessionBoundary({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState(!PUBLIC),[error,setError]=useState('');
 useEffect(()=>{
  if(!PUBLIC)return;
  let active=true;
  const check=()=>{refreshSession().then(ok=>{if(active&&ok)setReady(true);}).catch(()=>{if(active){setReady(false);setError('安全存取暫時無法使用，請重新整理。');}});};
  check();window.addEventListener('pageshow',check);window.addEventListener('focus',check);
  return()=>{active=false;window.removeEventListener('pageshow',check);window.removeEventListener('focus',check);clearTimeout(expiryTimer);};
 },[]);
 return ready?<>{children}</>:<main className="min-h-screen grid place-items-center bg-slate-950 text-cyan-100 p-6" role="status">{error||'正在驗證安全存取…'}</main>;
}
export function LogoutButton(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!PUBLIC)return null;
 return <div><button type="button" disabled={busy} className="px-3 py-2 text-xs border border-slate-300 rounded text-slate-700 disabled:opacity-50" onClick={async()=>{
  setBusy(true);setError('');try{const response=await authFetch('/auth/logout',{method:'POST'});if(!response.ok)throw new Error();returnToLogin();}catch{setError('登出未完成，請重試。');setBusy(false);}
 }}>Logout／登出</button>{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}</div>;
}
