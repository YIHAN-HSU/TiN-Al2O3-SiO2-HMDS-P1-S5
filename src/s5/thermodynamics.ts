import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export type Environment='GAS_PHASE_REFERENCE'|'SOLUTION_REFERENCE';
export interface ThermoContext {environment:Environment|null;temperature_k:number|null;standard_state:string|null;solvent:string|null;surface_model_id:string|null;morphology:string|null;facet:string|null;termination:string|null;silanol_density_nm2:number|null;hydration:string|null;tms_coverage_nm2:number|null;residual_oh_nm2:number|null;polarity_definition:string|null;contact_accessibility:string|null;steric_definition:string|null;}
export const ENERGY_CATEGORIES=['DFT_EADS','EXPERIMENTAL_DELTA_G','CALCULATED_DELTA_G','ADSORPTION_ENTHALPY','ADSORPTION_HEAT','OTHER'] as const;
export function context(value:any={}):ThermoContext {
 const str=(k:string)=>typeof value?.[k]==='string'&&value[k].trim()?value[k].trim():null;
 const num=(k:string)=>typeof value?.[k]==='number'&&Number.isFinite(value[k])?value[k]:null;
 const env=str('environment');if(env&&!['GAS_PHASE_REFERENCE','SOLUTION_REFERENCE'].includes(env))throw new Error('INVALID_THERMODYNAMIC_ENVIRONMENT');
 const t=num('temperature_k');if(t!==null&&t<=0)throw new Error('INVALID_TEMPERATURE');
 for(const k of ['silanol_density_nm2','tms_coverage_nm2','residual_oh_nm2'])if(num(k)!==null&&num(k)!<0)throw new Error('INVALID_SURFACE_DENSITY');
 return {environment:env as Environment|null,temperature_k:t,standard_state:str('standard_state'),solvent:str('solvent'),surface_model_id:str('surface_model_id'),morphology:str('morphology'),facet:str('facet'),termination:str('termination'),silanol_density_nm2:num('silanol_density_nm2'),hydration:str('hydration'),tms_coverage_nm2:num('tms_coverage_nm2'),residual_oh_nm2:num('residual_oh_nm2'),polarity_definition:str('polarity_definition'),contact_accessibility:str('contact_accessibility'),steric_definition:str('steric_definition')};
}
export function contextGaps(c:ThermoContext,hmds=false){const required:(keyof ThermoContext)[]=['environment','temperature_k','standard_state','surface_model_id','morphology','facet','termination','silanol_density_nm2','hydration'];if(c.environment==='SOLUTION_REFERENCE')required.push('solvent');if(hmds)required.push('tms_coverage_nm2','residual_oh_nm2','polarity_definition','contact_accessibility','steric_definition');return required.filter(k=>c[k]===null).map(k=>'MISSING_'+k.toUpperCase());}
export function key(c:ThermoContext){return JSON.stringify(context(c));}
export function sameThermo(a:ThermoContext,b:ThermoContext){return !!a.environment&&!!a.temperature_k&&!!a.standard_state&&['environment','temperature_k','standard_state','solvent'].every(k=>(a as any)[k]===(b as any)[k]);}
export function toEV(value:number,unit:string){if(!Number.isFinite(value))throw new Error('NONFINITE_ENERGY');if(unit==='eV')return value;if(unit==='kJ/mol')return value/96.48533212331002;if(unit==='kcal/mol')return value*4.184/96.48533212331002;throw new Error('UNSUPPORTED_ENERGY_UNIT');}
export interface ReferenceRecord {id:string;doi:string;title:string;year:number;molecule:string;smiles:string|null;inchikey:string|null;functional_groups:string[];substrate_id:string;energy_category:string;energy_definition:string;raw_value:number|null;raw_unit:string|null;energy_ev:number|null;context:ThermoContext;method:string;table:string;verification_status:string;training_eligible:boolean;exclusion_reasons:string[];}
export function eligible(r:ReferenceRecord){return ['EXPERIMENTAL_DELTA_G','CALCULATED_DELTA_G'].includes(r.energy_category)&&r.energy_definition==='TOTAL_STANDARD_ADSORPTION_GIBBS_FREE_ENERGY'&&r.verification_status==='VERIFIED'&&!!r.inchikey&&!!r.smiles&&!!r.doi&&!!r.method&&!!r.table&&typeof r.energy_ev==='number'&&Number.isFinite(r.energy_ev)&&typeof r.raw_value==='number'&&!!r.raw_unit&&Math.abs(toEV(r.raw_value,r.raw_unit)-r.energy_ev)<1e-12&&contextGaps(context(r.context),r.substrate_id==='HMDS_SiO2').length===0;}
export function loadReferences():ReferenceRecord[]{return JSON.parse(fs.readFileSync(path.resolve('reference/s5/dataset.json'),'utf8'));}
export interface GResult {value_ev:number|null;uncertainty_ev:number|null;prediction_method:string;validation_status:string;model_id:string|null;model_version:string|null;reference_source:any;applicability_domain:string;reason:string;}
export const unavailable=(reason:string):GResult=>({value_ev:null,uncertainty_ev:null,prediction_method:'NOT_AVAILABLE',validation_status:'MODEL_NOT_VALIDATED',model_id:null,model_version:null,reference_source:null,applicability_domain:'NOT_ESTABLISHED',reason});
export function lookup(identity:string,surface:string,c:ThermoContext,records=loadReferences()):GResult{
 const matches=records.filter(r=>r.substrate_id===surface&&r.inchikey===identity&&eligible(r)&&key(r.context)===key(c));
 if(matches.length!==1)return unavailable(matches.length?'AMBIGUOUS_REFERENCE_REQUIRES_REVIEW':'NO_VERIFIED_SAME_MOLECULE_SAME_CONTEXT_TOTAL_DELTA_G');
 const r=matches[0];return {...unavailable('Exact literature reference; not a new-molecule prediction.'),value_ev:r.energy_ev,prediction_method:'LITERATURE_REFERENCE',validation_status:'VERIFIED_REFERENCE',reference_source:{id:r.id,doi:r.doi,table:r.table,method:r.method}};
}
// Local registries are review-controlled. Request payloads never supply models/references.
// Models contain complete identity/family-disjoint independent-test evidence, recomputed below.
export function loadModels(){return JSON.parse(fs.readFileSync(path.resolve('models/s5/validated-models.json'),'utf8'));}
function vector(physical:any,names:string[]){return names.map(n=>physical?.[n]);}
function infer(m:any,x:number[]){return m.intercept_ev+x.reduce((sum,v,i)=>sum+(v-m.mean[i])/m.scale[i]*m.coefficients[i],0);}
export function validated(m:any,records:ReferenceRecord[]):boolean{try{
 if(m.status!=='VALIDATED'||m.independent_review?.approved!==true||!m.independent_review.reviewer||!m.independent_review.reference||!m.id||!m.version||!['DIRECT_DELTA_G','SURFACE_TRANSFER'].includes(m.kind)||!m.dataset_sha256)return false;
 const digest=crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex');if(digest!==m.dataset_sha256)return false;
 if(!Array.isArray(m.features)||m.features.length<1||new Set(m.features).size!==m.features.length||!m.features.every((x:any)=>typeof x==='string'))return false;
 const n=m.features.length;if(![m.mean,m.scale,m.coefficients,m.domain_min,m.domain_max].every(x=>Array.isArray(x)&&x.length===n&&x.every(Number.isFinite))||!m.scale.every((x:number)=>x>0)||!Number.isFinite(m.intercept_ev))return false;
 if(contextGaps(context(m.context),m.surface==='HMDS_SiO2').length||!['SiO2','HMDS_SiO2'].includes(m.surface))return false;
 const samples=m.samples;if(!Array.isArray(samples))return false;const train=samples.filter((s:any)=>s.split==='TRAIN'),test=samples.filter((s:any)=>s.split==='TEST');if(train.length<20||test.length<5)return false;
 const trainID=new Set(train.map((s:any)=>s.inchikey)),trainFamily=new Set(train.map((s:any)=>s.family));if(trainID.size!==train.length||new Set(test.map((s:any)=>s.inchikey)).size!==test.length||test.some((s:any)=>trainID.has(s.inchikey)||trainFamily.has(s.family)))return false;
 for(const s of samples){if(!s.family||!Array.isArray(s.x)||s.x.length!==n||!s.x.every(Number.isFinite)||!Number.isFinite(s.y_ev))return false;const r=records.find(r=>r.id===s.reference_id);if(!r||!eligible(r)||r.inchikey!==s.inchikey||r.substrate_id!==m.surface||key(r.context)!==key(m.context))return false;
  if(m.kind==='DIRECT_DELTA_G'){if(s.y_ev!==r.energy_ev)return false;}else{const base=records.find(r=>r.id===s.baseline_reference_id);if(!base||!eligible(base)||base.substrate_id!=='SiO2'||base.inchikey!==r.inchikey||key(base.context)!==key(m.baseline_context)||!sameThermo(base.context,r.context)||s.y_ev!==r.energy_ev!-base.energy_ev!)return false;}
 }
 const errors=test.map((s:any)=>infer(m,s.x)-s.y_ev),mae=errors.reduce((a:number,b:number)=>a+Math.abs(b),0)/test.length,rmse=Math.sqrt(errors.reduce((a:number,b:number)=>a+b*b,0)/test.length);
 if(!Number.isFinite(m.validation?.mae_ev)||!Number.isFinite(m.validation?.rmse_ev)||Math.abs(mae-m.validation.mae_ev)>1e-10||Math.abs(rmse-m.validation.rmse_ev)>1e-10||!(m.validation.acceptance_mae_ev>0)||!(m.validation.acceptance_rmse_ev>0)||mae>m.validation.acceptance_mae_ev||rmse>m.validation.acceptance_rmse_ev)return false;
 if(m.kind==='SURFACE_TRANSFER'){const average=train.reduce((a:number,s:any)=>a+s.y_ev,0)/train.length,baseline=Math.sqrt(test.reduce((a:number,s:any)=>a+(s.y_ev-average)**2,0)/test.length);if(Math.abs(baseline-m.validation.baseline_rmse_ev)>1e-10||!(baseline>rmse)||m.surface!=='HMDS_SiO2'||!m.uncertainty_assumption)return false;}
 // Domain bounds must be training bounds, never widened to cover query molecules.
 for(let i=0;i<n;i++)if(m.domain_min[i]!==Math.min(...train.map((s:any)=>s.x[i]))||m.domain_max[i]!==Math.max(...train.map((s:any)=>s.x[i])))return false;
 return true;
 }catch{return false;}}
export function predictG(surface:string,c:ThermoContext,physical:any,kind='DIRECT_DELTA_G',models=loadModels(),records=loadReferences()):GResult{
 const modelsHere=models.filter((m:any)=>m.surface===surface&&m.kind===kind&&key(m.context)===key(c)&&validated(m,records));if(modelsHere.length!==1)return unavailable('NO_UNIQUE_INDEPENDENTLY_VALIDATED_CONTEXT_MATCHED_MODEL');
 const m=modelsHere[0],x=vector(physical,m.features);if(x.some((v:any,i:number)=>!Number.isFinite(v)||v<m.domain_min[i]||v>m.domain_max[i]))return {...unavailable('MOLECULE_OUTSIDE_VALIDATED_DESCRIPTOR_DOMAIN'),applicability_domain:'OUT_OF_DOMAIN'};
 const value=infer(m,x);if(!Number.isFinite(value))return unavailable('NONFINITE_MODEL_OUTPUT');return {value_ev:value,uncertainty_ev:m.validation.rmse_ev,prediction_method:kind==='DIRECT_DELTA_G'?'VALIDATED_DELTA_G_MODEL':'VALIDATED_SURFACE_TRANSFER',validation_status:'INDEPENDENTLY_VALIDATED',model_id:m.id,model_version:m.version,reference_source:{dataset_sha256:m.dataset_sha256,validation:m.validation,review:m.independent_review,baseline_context:m.baseline_context,uncertainty_assumption:m.uncertainty_assumption},applicability_domain:'IN_DOMAIN',reason:'Independent test RMSE is an error estimate, not a per-molecule confidence interval.'};
}
export function transfer(base:GResult,delta:GResult,baseContext:ThermoContext,hmdsContext:ThermoContext,covariance:number|null=null,independenceJustification:string|null=null):GResult{
 if(!['INDEPENDENTLY_VALIDATED','VERIFIED_REFERENCE'].includes(base.validation_status)||delta.validation_status!=='INDEPENDENTLY_VALIDATED'||delta.prediction_method!=='VALIDATED_SURFACE_TRANSFER')return unavailable('VALIDATED_BASELINE_AND_TRANSFER_REQUIRED');
 if(base.value_ev===null||delta.value_ev===null||!sameThermo(baseContext,hmdsContext))return unavailable('COMPATIBLE_VALIDATED_SIO2_BASELINE_AND_TRANSFER_REQUIRED');
 if(base.uncertainty_ev===null||delta.uncertainty_ev===null)return unavailable('BASELINE_AND_TRANSFER_UNCERTAINTY_REQUIRED');
 if(covariance===null&&!independenceJustification)return unavailable('COVARIANCE_OR_JUSTIFIED_INDEPENDENCE_REQUIRED');
 const cov=covariance??0,variance=base.uncertainty_ev**2+delta.uncertainty_ev**2+2*cov;
 if(!Number.isFinite(cov)||Math.abs(cov)>base.uncertainty_ev*delta.uncertainty_ev||variance<0)return unavailable('INVALID_UNCERTAINTY_COVARIANCE');
 return {...delta,value_ev:base.value_ev+delta.value_ev,uncertainty_ev:Math.sqrt(variance),reference_source:{baseline:base,transfer:delta,covariance_ev2:cov,independence_justification:independenceJustification},reason:'Final HMDS ΔG = compatible SiO2 ΔG + validated predicted ΔΔG; uncertainties propagated.'};
}
