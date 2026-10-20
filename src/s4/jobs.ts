import fs from 'node:fs';import crypto from 'node:crypto';import {execFile,spawn,type ChildProcess} from 'node:child_process';import path from 'node:path';import {s4db} from './store';import {localPath,S4_ROOT} from './isolation';
let active:ChildProcess|null=null,checking=false;
const python=()=>localPath('.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
async function executionReady(id:string){return new Promise<boolean>(resolve=>execFile(python(),[localPath('backend/s4_dft.py'),'check',id],{cwd:S4_ROOT,timeout:30000,maxBuffer:2e6},(error,stdout)=>{try{resolve(!error&&JSON.parse(stdout).status==='READY');}catch{resolve(false);}}));}
export function startS4Queue(){const timer=setInterval(()=>void scheduleReadyJobs(),30000);timer.unref();}
async function scheduleReadyJobs(){
 if(active||checking||!fs.existsSync(localPath('dft/s4/config.json')))return;checking=true;
 try{const rows=s4db().prepare("SELECT job_id FROM s4_dft_jobs WHERE status='PENDING' ORDER BY created_at").all() as any[];
  for(const row of rows){const folder=localPath('dft/s4/jobs',row.job_id),state=JSON.parse(fs.readFileSync(path.join(folder,'status.json'),'utf8'));if(state.status!=='PENDING'||state.progress===95)continue;if(!await executionReady(row.job_id))continue;
   const output=fs.openSync(path.join(folder,'worker.log'),'a');active=spawn(python(),[localPath('backend/s4_dft.py'),'run',row.job_id],{cwd:S4_ROOT,stdio:['ignore',output,output],windowsHide:true});fs.closeSync(output);
   s4db().prepare('UPDATE s4_dft_jobs SET status=? WHERE job_id=?').run('RUNNING',row.job_id);
   active.on('error',error=>fs.writeFileSync(path.join(folder,'status.json'),JSON.stringify({status:'FAILED',reason:error.message,progress:null})));
   active.on('close',()=>{active=null;setImmediate(()=>void scheduleReadyJobs());});break;
  }
 }catch(error:any){fs.appendFileSync(localPath('logs/s4-queue.log'),new Date().toISOString()+' '+error.message+'\n');}finally{checking=false;}
}
export function surfaceContext(modelID:string){
 const p=localPath('dft/s4/config.json');let config:any={};try{config=JSON.parse(fs.readFileSync(p,'utf8'));}catch{}
 const surface=config.surfaces?.[modelID]||null;
 const digest=(data:any)=>crypto.createHash('sha256').update(data).digest('hex');
 let slabHash='NOT_CONFIGURED';if(surface?.poscar){const slab=localPath(surface.poscar);if(fs.existsSync(slab))slabHash=digest(fs.readFileSync(slab));}
 const fingerprint=digest(modelID+'\n'+(fs.existsSync(p)?digest(fs.readFileSync(p)):'NOT_CONFIGURED')+'\n'+slabHash);
 return {surface,fingerprint,reason:surface?.confirmed?'BACKEND_OR_INPUT_PREPARATION_REQUIRED':'SURFACE_DEFINITION_AND_COVERAGE_CONFIRMATION_REQUIRED'};
}
export function enqueue(substrateID:string,modelID:string,geometry:any){
 const db=s4db(),context=surfaceContext(modelID),key=crypto.createHash('sha256').update(JSON.stringify([geometry.inchikey,geometry.isomeric_smiles,substrateID,modelID,context.fingerprint])).digest('hex');
 const previous=db.prepare('SELECT job_id FROM s4_dft_jobs WHERE cache_key=?').get(key) as any;if(previous)return previous.job_id;
 const id=crypto.randomUUID(),folder=localPath('dft/s4/jobs',id);fs.mkdirSync(folder,{recursive:true});
 const request={job_id:id,substrate_id:substrateID,surface_model_id:modelID,surface_fingerprint:context.fingerprint,identity_key:geometry.inchikey,smiles:geometry.isomeric_smiles,atoms:geometry.atoms,created_at:new Date().toISOString(),reference_definition:'E_COMPLEX_MINUS_SURFACE_MINUS_MOLECULE',energy_unit:'eV'};
 fs.writeFileSync(path.join(folder,'request.json'),JSON.stringify(request,null,2));
 fs.writeFileSync(path.join(folder,'status.json'),JSON.stringify({status:'PENDING',progress:null,reason:context.reason,logs:['Job created. No DFT energy has been calculated. Surface definition, licensed potentials and backend must be configured.']},null,2));
 fs.writeFileSync(path.join(folder,'molecule.xyz'),`${geometry.atoms.length}\nRDKit geometry; NOT a surface DFT result\n${geometry.atoms.map((a:any)=>`${a.element} ${a.x} ${a.y} ${a.z}`).join('\n')}\n`);
 db.prepare('INSERT INTO s4_dft_jobs VALUES(?,?,?,?,?,?,?,?)').run(id,key,substrateID,modelID,geometry.inchikey,'PENDING',request.created_at,JSON.stringify(request));setImmediate(()=>void scheduleReadyJobs());return id;
}
export async function readJob(id:string){
 if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('INVALID_JOB_ID');
 const row=s4db().prepare('SELECT * FROM s4_dft_jobs WHERE job_id=?').get(id) as any;if(!row)throw new Error('JOB_NOT_FOUND');
 const folder=localPath('dft/s4/jobs',id);let status:any={status:'PENDING',progress:null};try{status=JSON.parse(fs.readFileSync(path.join(folder,'status.json'),'utf8'));}catch{}
 let result:any=null;
 if(fs.existsSync(path.join(folder,'result.json'))){
  try{result=await new Promise((resolve,reject)=>execFile(localPath('.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python'),[localPath('backend/s4_dft.py'),'verify',id],{cwd:S4_ROOT,timeout:30000,maxBuffer:2e6},(error,stdout)=>{if(error)return reject(error);try{resolve(JSON.parse(stdout));}catch(e){reject(e);}}));if(result.status!=='COMPLETED')result=null;}catch(e:any){status={...status,status:'FAILED',reason:'DFT_RESULT_VALIDATION_FAILED',error:e.message};}
 }
 if(status.status==='COMPLETED'&&!result)status={...status,status:'FAILED',reason:'MISSING_VALIDATED_DFT_RESULT'};
 const nextStatus=result?'COMPLETED':status.status;if(row.status!==nextStatus)s4db().prepare('UPDATE s4_dft_jobs SET status=? WHERE job_id=?').run(nextStatus,id);
 return {job_id:id,substrate_id:row.substrate_id,surface_model_id:row.surface_model_id,request:JSON.parse(row.request_json),...status,...(result?{status:'COMPLETED',progress:100,result}: {})};
}
