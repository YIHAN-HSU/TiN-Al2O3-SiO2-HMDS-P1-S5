import fs from 'node:fs';import path from 'node:path';import {execFile} from 'node:child_process';
export type PredictionMode='SCIENTIFIC_PREDICTION'|'HYPOTHETICAL_SIMULATION';
export interface HypotheticalRequest {prediction_mode?:PredictionMode;hypothetical_assumption_set?:string;hypothetical_parameter_overrides?:Record<string,number>;}
export function hypotheticalConfig(){return JSON.parse(fs.readFileSync(path.resolve('models/s5/hypothetical.json'),'utf8'));}
export function validateHypothetical(body:HypotheticalRequest):PredictionMode {
 const mode=body.prediction_mode??'SCIENTIFIC_PREDICTION';if(!['SCIENTIFIC_PREDICTION','HYPOTHETICAL_SIMULATION'].includes(mode))throw new Error('INVALID_PREDICTION_MODE');
 if(mode==='HYPOTHETICAL_SIMULATION'){
  const config=hypotheticalConfig(),preset=body.hypothetical_assumption_set??'BASELINE',overrides=body.hypothetical_parameter_overrides??{};
  if(!Object.hasOwn(config.presets,preset))throw new Error('UNKNOWN_ASSUMPTION_SET');
  if(typeof overrides!=='object'||Array.isArray(overrides)||overrides===null)throw new Error('ASSUMPTION_OVERRIDES_MUST_BE_OBJECT');
  for(const [key,value] of Object.entries(overrides)){const p=config.parameters[key];if(!p||typeof value!=='number'||!Number.isFinite(value)||value<p.minimum||value>p.maximum)throw new Error('INVALID_HYPOTHETICAL_PARAMETER:'+key);}
 }
 return mode;
}
export async function applyHypothetical(result:any,body:HypotheticalRequest){
 result.prediction_mode=validateHypothetical(body);
 if(result.prediction_mode==='SCIENTIFIC_PREDICTION')return;
 const payload={smiles:result.geometry.isomeric_smiles,shape:result.hybrid?.descriptors?.shape,assumption_set:body.hypothetical_assumption_set??'BASELINE',parameter_overrides:body.hypothetical_parameter_overrides??{}};
 const simulation:any=await new Promise((resolve,reject)=>{const child=execFile(process.env.PYTHON_EXECUTABLE||'python',[path.resolve('backend/s5_hypothetical.py')],{timeout:30000,maxBuffer:8*1024*1024,encoding:'utf8'},(err,out)=>{try{const value=JSON.parse(out);if(err||value.error)return reject(new Error(value.error||'HYPOTHETICAL_ENGINE_FAILED'));resolve(value);}catch{return reject(new Error('HYPOTHETICAL_ENGINE_INVALID_RESPONSE'));}});child.stdin!.end(JSON.stringify(payload));});
 const selected=new Set(result.substrate_ids);simulation.surfaces=Object.fromEntries(Object.entries(simulation.surfaces).filter(([s])=>selected.has(s)));
 if(!selected.has('SiO2')||!selected.has('HMDS_SiO2'))simulation.surface_difference={value_su:null,definition:'Both scenario surfaces must be selected; no physical delta-delta-G.',reason:'BOTH_SELECTED_SCENARIO_SURFACES_REQUIRED'};
 simulation.sensitivity_trials=simulation.sensitivity_trials.map((t:any)=>({...t,scores:Object.fromEntries(Object.entries(t.scores).filter(([s])=>selected.has(s)))}));
 // Scientific result objects are never mutated, overwritten or relabelled as SU.
 result.hypothetical=simulation;
}
