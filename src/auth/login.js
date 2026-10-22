// Credentials remain in this form only; no localStorage, URL, analytics, or logging.
const form=document.getElementById('login-form'),password=document.getElementById('password');
const toggle=document.getElementById('toggle'),button=document.getElementById('login'),message=document.getElementById('message');
let csrf='';
async function session(){
 const response=await fetch('/auth/session',{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)throw new Error('安全存取暫時無法使用，請稍後重新整理。');
 const state=await response.json();if(state.authenticated){location.replace('/');return;}
 csrf=state.csrf_token;button.disabled=false;
}
session().catch(error=>{message.textContent=error.message;});
toggle.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'Hide':'Show';toggle.setAttribute('aria-label',show?'Hide password':'Show password');toggle.setAttribute('aria-pressed',String(show));});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!csrf||button.disabled)return;button.disabled=true;message.textContent='';
 try{
  const body=JSON.stringify({password:password.value});password.value='';
  const response=await fetch('/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Adsorvia-CSRF':csrf},body});
  const state=await response.json();if(response.ok&&state.authenticated){location.replace('/');return;}
  message.textContent=state.error||'登入失敗，請稍後再試。';
  if(response.status===403)await session();
 }catch{message.textContent='無法連線，請稍後再試。';}
 finally{password.value='';button.disabled=false;password.focus();}
});
