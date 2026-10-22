// Run interactively in your own terminal. Never pass a password on the command line.
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {hashPassword} from '../src/auth/password';
async function hidden(prompt:string):Promise<string>{
 process.stdout.write(prompt);
 return new Promise((resolve,reject)=>{
  let value='';const decoder=new StringDecoder('utf8');process.stdin.setRawMode(true);process.stdin.resume();
  const done=(error?:Error)=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value);};
  const onData=(chunk:Buffer)=>{for(const char of decoder.write(chunk)){
   if(char==='\u0003')return done(new Error('Cancelled.'));
   if(char==='\r'||char==='\n')return done();
   if(char==='\u007f'||char==='\b'){
    if(value){value=Array.from(value).slice(0,-1).join('');process.stdout.write('\b \b');}
   }else if(char>=' '){value+=char;process.stdout.write('*');}
  }};process.stdin.on('data',onData);
 });
}
async function waitForEnter():Promise<void>{
 return new Promise((resolve,reject)=>{
  process.stdin.setRawMode(true);process.stdin.resume();
  const finish=(error?:Error)=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();error?reject(error):resolve();};
  const onData=(chunk:Buffer)=>{
   const keys=chunk.toString('utf8');
   if(keys.includes('\u0003'))return finish(new Error('Cancelled.'));
   if(keys.includes('\r')||keys.includes('\n'))finish();
  };
  process.stdin.on('data',onData);
  process.stdout.write('[Press Enter to continue]\n');
 });
}
try{
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Run in your own interactive terminal; redirected input/output is refused.');
 if(process.platform!=='win32')throw new Error('This clipboard helper targets Windows. Generate equivalent values with Node crypto on other systems.');
 const mode=process.argv[2];let value:string,key:string;
 if(mode==='wait'){await waitForEnter();process.exit(0);}
 if(mode==='hash'){
  let password=await hidden('New website password (* masked, at least 16 characters): ');
  let confirmation=await hidden('Confirm password (* masked): ');
  if(password!==confirmation)throw new Error('Passwords do not match.');
  value=await hashPassword(password);password='';confirmation='';key='ADSORVIA_PASSWORD_HASH';
 }else if(mode==='session'){value=randomBytes(48).toString('base64url');key='ADSORVIA_SESSION_SECRET';}
 else throw new Error('Use npm run auth:hash or npm run auth:secret.');
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Set-Clipboard -Value ([Console]::In.ReadToEnd())'],{input:value,encoding:'utf8',windowsHide:true,stdio:['pipe','ignore','ignore']});
 value='';if(result.status!==0)throw new Error('Clipboard was not available. Nothing was saved or printed.');
 console.log(`${key} copied to your local clipboard. Paste into the matching Render Environment field, then clear the clipboard. No credential file was created.`);
}catch(error){console.error(error instanceof Error?error.message:'Credential generation failed.');process.exitCode=1;}
