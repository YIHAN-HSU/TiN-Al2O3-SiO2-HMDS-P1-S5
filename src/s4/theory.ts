import fs from 'node:fs';import crypto from 'node:crypto';import {localPath} from './isolation';
export const THEORY_MODELS:any[]=[]; // No validated production SiO2 or HMDS dataset is available.
export function predictTheory(surfaceID:string,fingerprint:string,descriptors:any,models=THEORY_MODELS){
 for(const m of models){try{
  if(!m.enabled||!m.model_id||!m.version||!m.method_fingerprint||m.status!=='INDEPENDENTLY_VALIDATED'||m.surface_model_id!==surfaceID||m.surface_fingerprint!==fingerprint||m.energy_definition!=='E_COMPLEX_MINUS_SURFACE_MINUS_MOLECULE'||m.energy_unit!=='eV'||m.method!=='STANDARDIZED_RIDGE_ABSOLUTE_EADS'||!m.independent_review_approved)continue;
  const records=m.dataset.records;if(!Array.isArray(records)||crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex')!==m.dataset.sha256)continue;
  const train=records.filter((r:any)=>r.split==='TRAIN'),test=records.filter((r:any)=>r.split==='TEST');
  if(train.length<20||test.length<5||!records.every((r:any)=>r.source&&r.family_id&&r.identity_key&&r.surface_fingerprint===fingerprint&&r.energy_unit==='eV'&&r.method_fingerprint===m.method_fingerprint&&r.energy_definition===m.energy_definition&&Number.isFinite(r.eads_ev)))continue;
  if(test.some((r:any)=>train.some((t:any)=>t.identity_key===r.identity_key||t.family_id===r.family_id)))continue;
  const features=m.parameters.features;if(!Array.isArray(features)||new Set(features.map((f:any)=>f.name)).size<2||!Number.isFinite(m.parameters.intercept_ev)||!features.every((f:any)=>Number.isFinite(f.scale)&&f.scale>0&&Number.isFinite(f.mean)&&Number.isFinite(f.coefficient_ev)))continue;
  if(!Number.isFinite(m.validation.max_mae_ev)||!Number.isFinite(m.validation.max_rmse_ev)||m.validation.max_mae_ev<0||m.validation.max_rmse_ev<0)continue;
  const evaluate=(d:any)=>m.parameters.intercept_ev+features.reduce((sum:number,f:any)=>sum+(d[f.name]-f.mean)/f.scale*f.coefficient_ev,0);
  const errors=test.map((r:any)=>evaluate(r.features)-r.eads_ev);const mae=errors.reduce((s:number,e:number)=>s+Math.abs(e),0)/errors.length,rmse=Math.sqrt(errors.reduce((s:number,e:number)=>s+e*e,0)/errors.length);
  if(!Number.isFinite(mae)||!Number.isFinite(rmse)||Math.abs(mae-m.validation.mae_ev)>1e-10||Math.abs(rmse-m.validation.rmse_ev)>1e-10||mae>m.validation.max_mae_ev||rmse>m.validation.max_rmse_ev)continue;
  if(features.some((f:any)=>{const value=descriptors?.[f.name],range=m.applicability_domain?.[f.name];return !Number.isFinite(value)||!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]>range[1]||value<range[0]||value>range[1];}))return {status:'OUT_OF_DOMAIN',eads_ev:null,model:m};
  const value=evaluate(descriptors);if(!Number.isFinite(value))continue;
  return {status:'THEORY_PREDICTED',eads_ev:value,model:m};
 }catch{continue;}}
 return {status:'NOT_AVAILABLE',eads_ev:null,model:null};
}
export function loadTheoryModels(){const p=localPath('models/s4/validated-models.json');if(!fs.existsSync(p))return [];try{const values=JSON.parse(fs.readFileSync(p,'utf8'));return Array.isArray(values)?values:[];}catch{return [];}}
