import {execFile} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type {AnalyzeRequest} from './fluorine';
import {applyUniversalIntegration} from './universalBridge';
import {processChemicalInput} from '../chemistry/backendEngine';
import {predict_tin_oxoh_adsorption} from '../models/tinPredictionEngine';
import {TIN_CONFIG} from '../models/tin/tinModelConfig';
import {getDatabase,upsertMaterial,logAnalysisHistory,logConformerHistory,insertPredictionHistory,getAllDatabaseHistory} from '../db/database';
export const tinHash=crypto.createHash('sha256').update(['src/models/tinPredictionEngine.ts','src/models/tin/tinPredictionEngine.ts','src/models/tin/tinModelConfig.ts'].map(f=>fs.readFileSync(f,'utf8')).join('\n')).digest('hex');
export async function v12(payload:any,python=process.env.PYTHON_EXECUTABLE || (process.platform==='win32'?'python':'python3')) {
 return new Promise<any>((resolve,reject)=>{
  const child=execFile(python,[path.resolve('backend/safe_v12.py'),'parse'],{timeout:90000,maxBuffer:12*1024*1024,encoding:'utf8'},(err,stdout,stderr)=>{
   if(err)return reject(new Error(`PYTHON_EXECUTION_FAILED: ${err.message}; ${stderr.slice(-1000)}`));
   try{resolve(JSON.parse(stdout));}catch{reject(new Error('INVALID_ENGINE_JSON'));}
  });child.stdin!.end(JSON.stringify(payload));
 });
}
export function comparison(tin:any,al:any){
 const common={selectivity_preference:'INCONCLUSIVE',calibration_banner:'NOT QUANTITATIVELY CALIBRATED',delta_eads_ev:null,delta_eads_label:'UNAVAILABLE',interpretation:'Authoritative energy definitions/reference states are NOT SPECIFIED; quantitative selectivity cannot be established.'};
 if(!tin || al?.status_code!=='SUCCESS')return {...common,comparison_status:'MODEL_UNAVAILABLE'};
 if(tin.source_inchikey!==al.source_inchikey)return {...common,comparison_status:'MOLECULAR_IDENTITY_MISMATCH'};
 if(tin.energy_definition==='NOT SPECIFIED'||al.energy_definition==='NOT SPECIFIED'||tin.energy_reference!==al.energy_reference||tin.energy_unit!==al.energy_unit||tin.energy_definition!==al.energy_definition)
  return {...common,comparison_status:'INCOMPATIBLE_ENERGY_DEFINITIONS'};
 const delta=tin.raw_predicted_eads_ev-al.raw_predicted_eads_ev;
 return {...common,delta_eads_ev:delta,delta_eads_label:`${delta} eV`,comparison_status:'EXPLORATORY',interpretation:'Exploratory arithmetic only; NOT QUANTITATIVELY CALIBRATED.'};
}
function finite(value:any):boolean{return typeof value==='number'?Number.isFinite(value):value&&typeof value==='object'?Object.values(value).every(finite):true;}
export async function integratedAnalyze(body:AnalyzeRequest,options:{tinFailure?:boolean;alFailure?:boolean}={}) {
 const mode=body.mode||'DUAL';if(!['TIN_ONLY','AL2O3_ONLY','DUAL'].includes(mode))throw new Error('INVALID_MODE');
 const input=body.selected_mol_block||body.candidate_smiles||body.raw_text;
 if(typeof input!=='string'||!input.trim())throw new Error('EMPTY_INPUT');
 if(body.input_type==='IMAGE'&&!body.candidate_confirmed)throw new Error('IMAGE_CANDIDATE_CONFIRMATION_REQUIRED');
 const kind=body.selected_mol_block?'mdl':body.input_type==='IMAGE'?'smiles':(body.input_type||'smiles').toLowerCase();
 let geometry:any=null,analysis:any=null,tin:any=null,al:any=null;const errors:any={};
 try{geometry=await v12({input_type:kind,input_data:input,prediction_enabled:mode!=='TIN_ONLY'});if(geometry.status!=='SUCCESS')throw new Error(geometry.error||'RDKIT_FAILED');}catch(e:any){geometry=null;errors.geometry=e.message;}
 if(mode!=='AL2O3_ONLY')try{
  analysis=await processChemicalInput(geometry?'SMILES':body.input_type,{raw_text:geometry?.isomeric_smiles||input});
  if(analysis.status!=='SUCCESS'||!analysis.descriptors||!analysis.functional_groups)throw new Error(analysis.error_message||analysis.status);
  if(geometry&&analysis.molecular_identity.inchikey!==geometry.inchikey)throw new Error('MOLECULAR_IDENTITY_MISMATCH');
  if(!finite(analysis.descriptors))throw new Error('NON_FINITE_DESCRIPTOR');
  if(options.tinFailure)throw new Error('INJECTED_TIN_FAILURE_TEST');
  const original=predict_tin_oxoh_adsorption(analysis.descriptors,analysis.functional_groups);
  tin={...original,source_inchikey:analysis.molecular_identity.inchikey,formula_hash:tinHash,confidence:'NOT_ESTABLISHED',original_confidence:original.confidence,calibration_status:'NOT_QUANTITATIVELY_CALIBRATED',energy_unit:'eV',energy_reference:'NOT SPECIFIED',energy_definition:'NOT SPECIFIED',surface_model_version:'NOT SPECIFIED',surface_assumptions:'Oxidized/Hydroxylated TiN; coverage NOT SPECIFIED',dft_status:'NOT_CALCULATED'};
  if(!finite(tin))throw new Error('NON_FINITE_EADS');
 }catch(e:any){tin=null;errors.tin=e.message;}
 if(mode!=='TIN_ONLY')try{
  if(options.alFailure)throw new Error('INJECTED_AL2O3_FAILURE_TEST');
  if(!geometry)throw new Error(errors.geometry||'RDKIT_FAILED');
  al={...geometry.ai_prediction,energy_unit:'eV'};if(!finite(al))throw new Error('NON_FINITE_EADS');
 }catch(e:any){errors.al2o3=e.message;al={installed:false,status_code:'FAILED',error:e.message,raw_predicted_eads_ev:null,predicted_eads_ev:null};}
 const db=getDatabase();db.exec('CREATE TABLE IF NOT EXISTS p0p1_predictions (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, identity_key TEXT NOT NULL, model_id TEXT NOT NULL, model_version TEXT NOT NULL, surface_id TEXT NOT NULL, formula_hash TEXT NOT NULL, cache_key TEXT NOT NULL, result_json TEXT NOT NULL)');
 const fluorine=geometry?.fluorine||null;
 const bridge_descriptors=geometry?.bridge_descriptors||null;
 const universal_structure=geometry?.universal_structure||null;
 const universal_descriptors=geometry?.universal_descriptors||null;
 if(tin)Object.assign(tin,applyUniversalIntegration(tin,fluorine,bridge_descriptors,universal_structure,universal_descriptors));
 if(al?.status_code==='SUCCESS')Object.assign(al,applyUniversalIntegration(al,fluorine,bridge_descriptors,universal_structure,universal_descriptors));
 const identity=geometry?.inchikey||analysis?.molecular_identity?.inchikey;
 const comp=comparison(tin,al);
 db.exec('BEGIN TRANSACTION');
 try{
  if(tin&&analysis){
   const m=upsertMaterial(analysis.molecular_identity);
   logAnalysisHistory({material_id:m.id,input_type:body.input_type,raw_input:input,status:'SUCCESS'});
   if(geometry?.is_real_3d)logConformerHistory({material_id:m.id,conformer_id:'ZIP12-REAL-'+crypto.randomUUID(),optimization_method:'ZIP12 REAL: '+geometry.conformer_engine,energy:geometry.conformer_energy,coords_json:JSON.stringify(geometry.atoms)});
   insertPredictionHistory({...tin,material_id:m.id,supported_groups_json:JSON.stringify(tin.supported_groups),extrapolated_groups_json:JSON.stringify(tin.extrapolated_groups)} as any);
  }
  for(const result of [tin,al])if(result?.model_id&&typeof result.raw_predicted_eads_ev==='number'){
   const key=[identity,geometry?.isomeric_smiles||analysis?.molecular_identity?.canonical_smiles,result.model_id,result.model_version,result.surface_id,result.formula_hash].join('|');result.cache_key=key;result.cache_status='DISABLED_FRESH_EXECUTION';
   db.prepare('INSERT INTO p0p1_predictions(created_at,identity_key,model_id,model_version,surface_id,formula_hash,cache_key,result_json) VALUES(?,?,?,?,?,?,?,?)').run(new Date().toISOString(),identity,result.model_id,result.model_version,result.surface_id,result.formula_hash,key,JSON.stringify(result));
  }db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 const groups=analysis?.functional_groups||{};
 const groupMap:any={OH:'OH',COOH:'COOH',carbonyl:'Carbonyl',ester:'Ester',ether:'Ether',amine:'Amine',amide:'Amide',nitrile:'Nitrile',aromatic_ring:'Aromatic',alkene_cc:'C=C'};
 const termMap:any={OH:'e_oh',COOH:'e_cooh',carbonyl:'e_carbonyl',ester:'e_ester',ether:'e_ether',amine:'e_amine',amide:'e_amide',nitrile:'e_nitrile',aromatic_ring:'e_aromatic',alkene_cc:'e_ene'};
 const transparency=Object.entries(groupMap).map(([key,name]:any)=>({group:key,tin_actual_count:groups[key]?.count??null,tin_effective_count:groups[key]?.count??null,tin_contribution_ev:tin&&groups[key]?TIN_CONFIG.SLOPE_EV*(TIN_CONFIG.WEIGHTS as any)[key]*groups[key].count:null,al2o3_actual_count:al?.features?.fg_counts?.[name]??null,al2o3_effective_count:al?.effective_counts?.[termMap[key]]??null,al2o3_contribution_ev:al?.functional_group_contributions?.[termMap[key]]??null,al2o3_expression:al?.contribution_expressions?.[termMap[key]]??null}));
 return {mode,fluorine,bridge_descriptors,universal_structure,universal_descriptors,analysis,prediction:tin,al2o3:al,comparison:comp,geometry,transparency,errors,history:getAllDatabaseHistory(),dft_status:'NOT_CALCULATED',applicability:'NOT_ESTABLISHED'};
}

export type IntegratedAnalyzeResponse=Awaited<ReturnType<typeof integratedAnalyze>>;
