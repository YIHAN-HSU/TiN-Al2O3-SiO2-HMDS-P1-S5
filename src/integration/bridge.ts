import type {FluorineDescriptors} from './fluorine';
import {createHash} from 'node:crypto';
export interface BridgeDescriptors {
 descriptor_id:string; descriptor_version:string; source_inchikey:string;
 physical_status:string; physical:Record<string,number>;
 size_3d:{status:string;[key:string]:number|string|null};
 conformer:{status:string;engine:string|null;conformer_sha256:string|null;[key:string]:unknown};
 electronic:Record<string,{status:string;value:number|number[]|null;unit:string;method:string|null;backend:string|null;[key:string]:unknown}>;
 electronic_status:string;[key:string]:unknown;
}
export interface BridgeReference {
 identity_key:string;family_id:string;dataset_id:string;split:'TRAIN'|'VALIDATION';
 original_eads_ev:number;reference_eads_ev:number;features:Record<string,number>;
}
export interface BridgeModel {
 model_id:string;version:string;surface_id:string;surface_assumptions:string;
 enabled:boolean;status:'VALIDATED';method:'STANDARDIZED_LINEAR_RESIDUAL';
 descriptor_version:string;fluorine_descriptor_version:string;target:'EADS_REFERENCE_MINUS_ORIGINAL';
 original_model:{model_id:string;formula_hash:string;accounted_descriptors:string[];strategy:'TRAIN_ON_REFERENCE_MINUS_ORIGINAL'};
 energy_reference:string;energy_definition:string;
 dataset:{id:string;sha256:string;provenance:string;reference_method:string;records:BridgeReference[]};
 validation:{report:string;independent_dataset_id:string;mae_ev:number;rmse_ev:number;max_mae_ev:number;max_rmse_ev:number};
 applicability_domain:{identity_keys:string[];feature_ranges:Record<string,[number,number]>;conformer_engines?:string[]};
 parameters:{intercept_ev:number;features:{name:string;mean:number;scale:number;coefficient_ev:number}[]};
}
export interface BridgeOutput {
 original_eads_ev:number;bridge_correction_ev:number|null;corrected_eads_ev:number|null;displayed_eads_ev:number;
 bridge_status:'NOT_CALIBRATED'|'CALIBRATED';bridge_reason:string;bridge_engine_version:string;
 bridge_model:Omit<BridgeModel,'parameters'|'dataset'> & {dataset:Omit<BridgeModel['dataset'],'records'>}|null;
 reference_dataset:{id:string;sha256:string;provenance:string}|null;
 bridge_descriptors:BridgeDescriptors|null;
}
export const BRIDGE_ENGINE_VERSION='P1-F-BRIDGE-1.0.0';
// Separate trusted registries. No production B-C dataset/model currently meets the evidence requirements.
export const TIN_BRIDGE_MODELS:readonly BridgeModel[]=Object.freeze([]);
export const AL2O3_BRIDGE_MODELS:readonly BridgeModel[]=Object.freeze([]);
export function bridgeFeatures(f:FluorineDescriptors|null,b:BridgeDescriptors|null):Record<string,number>{
 const result:Record<string,number>={};
 for(const [key,v] of Object.entries(b?.physical||{}))if(Number.isFinite(v))result['physical.'+key]=v;
 if(b?.size_3d.status==='CALCULATED')for(const [key,v] of Object.entries(b.size_3d))if(typeof v==='number'&&Number.isFinite(v))result['size_3d.'+key]=v;
 for(const [key,v] of Object.entries(b?.electronic||{}))if(v.status==='CALCULATED'&&v.method&&v.backend&&typeof v.value==='number'&&Number.isFinite(v.value))result['electronic.'+key]=v.value;
 if(f){for(const key of ['f_atom_count','fluorinated_carbon_count','f_c_ratio','aromatic_cf3_count'] as const)if(typeof f[key]==='number'&&Number.isFinite(f[key]))result['fluorine.'+key]=f[key];
  for(const [key,v] of Object.entries(f.classification))result['fluorine.classification.'+key]=v;}
 return result;
}
function linear(m:BridgeModel,x:Record<string,number>):number|null {
 if(!Number.isFinite(m.parameters.intercept_ev)||!m.parameters.features.length||new Set(m.parameters.features.map(t=>t.name)).size!==m.parameters.features.length)return null;
 let sum=m.parameters.intercept_ev;
 for(const t of m.parameters.features){if(!Number.isFinite(x[t.name])||!Number.isFinite(t.mean)||!Number.isFinite(t.scale)||t.scale<=0||!Number.isFinite(t.coefficient_ev))return null;sum+=t.coefficient_ev*(x[t.name]-t.mean)/t.scale;}
 return Number.isFinite(sum)?sum:null;
}
export function validateBridgeModel(m:BridgeModel):boolean {
 try{
  if(!m.enabled||m.status!=='VALIDATED'||!m.model_id||!m.version||!m.surface_id||!m.surface_assumptions||m.method!=='STANDARDIZED_LINEAR_RESIDUAL'||m.target!=='EADS_REFERENCE_MINUS_ORIGINAL'||
   m.original_model.strategy!=='TRAIN_ON_REFERENCE_MINUS_ORIGINAL'||!m.original_model.accounted_descriptors.length||!m.original_model.model_id||!m.original_model.formula_hash||
   !m.descriptor_version||!m.fluorine_descriptor_version||!Array.isArray(m.applicability_domain.identity_keys)||!m.applicability_domain.identity_keys.length||!m.applicability_domain.feature_ranges||
   !m.dataset.id||!m.dataset.provenance||!m.dataset.reference_method||! /^[a-f0-9]{64}$/i.test(m.dataset.sha256)||!m.validation.report||!m.validation.independent_dataset_id||m.validation.independent_dataset_id===m.dataset.id||
   !m.energy_reference||!m.energy_definition||[m.energy_reference,m.energy_definition].includes('NOT SPECIFIED'))return false;
  const train=m.dataset.records.filter(r=>r.split==='TRAIN'),valid=m.dataset.records.filter(r=>r.split==='VALIDATION');
  if(createHash('sha256').update(JSON.stringify(m.dataset.records)).digest('hex')!==m.dataset.sha256)return false;
  if(!train.length||!valid.length||new Set(m.dataset.records.map(r=>r.identity_key)).size!==m.dataset.records.length)return false;
  const trainFamilies=new Set(train.map(r=>r.family_id));
  if(valid.some(r=>!r.family_id||trainFamilies.has(r.family_id)||r.dataset_id!==m.validation.independent_dataset_id)||train.some(r=>!r.family_id||r.dataset_id!==m.dataset.id))return false;
  for(const r of m.dataset.records)if(!r.identity_key||!Number.isFinite(r.original_eads_ev)||!Number.isFinite(r.reference_eads_ev)||linear(m,r.features)===null)return false;
  const errors=valid.map(r=>linear(m,r.features)!-(r.reference_eads_ev-r.original_eads_ev));
  const mae=errors.reduce((a,e)=>a+Math.abs(e),0)/errors.length,rmse=Math.sqrt(errors.reduce((a,e)=>a+e*e,0)/errors.length);
  const v=m.validation;
  return [v.mae_ev,v.rmse_ev,v.max_mae_ev,v.max_rmse_ev].every(Number.isFinite)&&v.mae_ev>=0&&v.rmse_ev>=0&&v.max_mae_ev>0&&v.max_rmse_ev>0&&Math.abs(mae-v.mae_ev)<1e-10&&Math.abs(rmse-v.rmse_ev)<1e-10&&mae<=v.max_mae_ev&&rmse<=v.max_rmse_ev;
 }catch{return false;}
}
export function applyBridge(original:any,f:FluorineDescriptors|null,b:BridgeDescriptors|null,models?:readonly BridgeModel[]):BridgeOutput {
 const raw=original.raw_predicted_eads_ev;
 const base:BridgeOutput={original_eads_ev:raw,bridge_correction_ev:null,corrected_eads_ev:null,displayed_eads_ev:raw,bridge_status:'NOT_CALIBRATED',bridge_reason:'No applicable independently validated surface-specific reference residual model.',bridge_engine_version:BRIDGE_ENGINE_VERSION,bridge_model:null,reference_dataset:null,bridge_descriptors:b};
 if(!Number.isFinite(raw)||!f||!b||f.source_inchikey!==original.source_inchikey||b.source_inchikey!==original.source_inchikey||b.physical_status!=='CALCULATED')return {...base,bridge_reason:'Verified A-B descriptors unavailable or molecular identity mismatch.'};
 const registry=models||(original.surface_id?.startsWith('TIN_')?TIN_BRIDGE_MODELS:original.surface_id?.startsWith('AL2O3_')?AL2O3_BRIDGE_MODELS:[]);
 const x=bridgeFeatures(f,b);
 const candidates=registry.filter(m=>validateBridgeModel(m)&&m.surface_id===original.surface_id&&m.surface_assumptions===original.surface_assumptions&&m.original_model.model_id===original.model_id&&m.original_model.formula_hash===original.formula_hash&&m.energy_reference===original.energy_reference&&m.energy_definition===original.energy_definition&&m.descriptor_version===b.descriptor_version&&m.fluorine_descriptor_version===f.descriptor_version&&m.applicability_domain.identity_keys.includes(f.source_inchikey)&&!m.dataset.records.some(r=>r.split==='TRAIN'&&r.identity_key===f.source_inchikey)&&m.parameters.features.every(t=>{
  if(t.name.startsWith('size_3d.')&&!m.applicability_domain.conformer_engines?.includes(b.conformer.engine||''))return false;
  const range=m.applicability_domain.feature_ranges[t.name];return range?.length===2&&range.every(Number.isFinite)&&range[0]<=range[1]&&Number.isFinite(x[t.name])&&x[t.name]>=range[0]&&x[t.name]<=range[1];
 }));
 if(candidates.length!==1)return base;
 const m=candidates[0],delta=linear(m,x);if(delta===null||!Number.isFinite(raw+delta))return base;
 const {parameters:_,dataset,...meta}=m,{records:__,...datasetMeta}=dataset;
 return {...base,bridge_correction_ev:delta,corrected_eads_ev:raw+delta,displayed_eads_ev:raw+delta,bridge_status:'CALIBRATED',bridge_reason:'Independently validated reference-minus-original residual, within declared descriptor and identity domain. No standalone MW/TPSA energy term added.',bridge_model:{...meta,dataset:datasetMeta},reference_dataset:{id:dataset.id,sha256:dataset.sha256,provenance:dataset.provenance}};
}
// Keep the prior API aliases coherent while the integrated pipeline upgrades to Bridge.
export function applyBridgeIntegration(original:any,f:FluorineDescriptors|null,b:BridgeDescriptors|null){
 const bridge=applyBridge(original,f,b);
 return {...bridge,fluorine:f,fluorine_correction_ev:bridge.bridge_correction_ev,fluorine_status:bridge.bridge_status==='CALIBRATED'?'CALIBRATED':!f?'ANALYSIS_UNAVAILABLE':f.has_fluorine?'NOT_CALIBRATED':'NOT_APPLICABLE',correction_model:bridge.bridge_model,correction_reason:bridge.bridge_reason,correction_adapter_version:bridge.bridge_engine_version};
}
