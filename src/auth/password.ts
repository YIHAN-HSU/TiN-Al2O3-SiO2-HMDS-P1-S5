import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
// OWASP scrypt profile: 32 MiB, r=8, p=3. Fixed policy prevents weak/malformed parameters.
const N=32768,r=8,p=3;
const pattern=/^\$adsorvia\$scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{64})$/;
export function validPasswordHash(value:string){return pattern.test(value);}
function derive(password:string,salt:Buffer):Promise<Buffer>{
 return new Promise((resolve,reject)=>scrypt(password,salt,32,{N,r,p,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
}
export async function hashPassword(password:string){
 if(Buffer.byteLength(password,'utf8')>1024||password.length<16)throw new Error('Use a password of at least 16 characters (maximum 1024 UTF-8 bytes).');
 const salt=randomBytes(16),key=await derive(password,salt);
 return `$adsorvia$scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(password:unknown,encoded:string){
 const match=pattern.exec(encoded);
 if(!match||typeof password!=='string'||!password.length||Buffer.byteLength(password,'utf8')>1024)return false;
 return timingSafeEqual(await derive(password,Buffer.from(match[1],'hex')),Buffer.from(match[2],'hex'));
}
