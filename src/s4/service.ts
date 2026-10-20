import crypto from 'node:crypto';import {integratedAnalyze,v12,comparison} from '../integration/service';import {getAllDatabaseHistory} from '../db/database';
import type {AnalyzeRequest} from '../integration/fluorine';import {SUBSTRATES,S4_VERSION,canonicalSurfaceState,AL2O3_METHOD,type SurfaceResult,type SubstrateID} from './registry';import {s4db} from './store';import {enqueue,readJob,surfaceContext} from './jobs';import {predictTheory,loadTheoryModels} from './theory';
import {hydrateAl2o3History} from './al2o3Compatibility';
export interface FourRequest extends AnalyzeRequest {substrates:SubstrateID[];surface_conditions?:Partial<Record<SubstrateID,string>>;}
export async function analyzeFour(body:FourRequest){
 if(!Array.isArray(body.substrates)||!body.substrates.length||body.substrates.length>4||new Set(body.substrates).size!==body.substrates.length||body.substrates.some(id=>!SUBSTRATES.some(s=>s.id===id)))throw new Error('SELECT_ONE_TO_FOUR_UNIQUE_VALID_SUBSTRATES');
 const choices=body.substrates.map(id=>{const substrate=SUBSTRATES.find(s=>s.id===id)!;const condition=canonicalSurfaceState(id,body.surface_conditions?.[id]||substrate.states[0].id);const state=substrate.states.find(s=>s.id===condition);if(!state)throw new Error(id==='Al2O3'?'AL2O3_ONLY_HYDROXYLATED_V12_SUPPORTED':'INVALID_SURFACE_CONDITION:'+id);return {substrate,state};});
 const tin=choices.some(c=>c.substrate.id==='TiN'&&c.state.id==='ORIGINAL'),al=choices.some(c=>c.substrate.id==='Al2O3'&&c.state.id==='HYDROXYLATED');
 let shared:any;
 if(tin||al)shared=await integratedAnalyze({...body,mode:tin&&al?'DUAL':tin?'TIN_ONLY':'AL2O3_ONLY'});
 else {
  const input=body.selected_mol_block||body.candidate_smiles||body.raw_text;if(typeof input!=='string'||!input.trim())throw new Error('EMPTY_INPUT');
  if(body.input_type==='IMAGE')throw new Error('OCSR_NOT_VERIFIED_DISABLED');
  const g=await v12({input_type:body.selected_mol_block?'mdl':(body.input_type||'SMILES').toLowerCase(),input_data:input,prediction_enabled:false});
  if(g.status!=='SUCCESS')throw new Error(g.error||'MOLECULAR_ANALYSIS_FAILED');
  shared={geometry:g,analysis:null,prediction:null,al2o3:null,comparison:comparison(null,null),fluorine:g.fluorine,bridge_descriptors:g.bridge_descriptors,universal_structure:g.universal_structure,universal_descriptors:g.universal_descriptors,transparency:[],errors:{},history:getAllDatabaseHistory(),dft_status:'NOT_CALCULATED'};
 }
 const identity=shared.geometry?.inchikey||shared.analysis?.molecular_identity?.inchikey;if(!identity)throw new Error('MOLECULAR_ANALYSIS_FAILED:'+JSON.stringify(shared.errors));
 const rows:SurfaceResult[]=[];
 for(const {substrate,state} of choices){
  const row:SurfaceResult={substrate_id:substrate.id,surface_state:state.id,surface_model_id:state.model_id,surface_model_version:state.version,raw_eads_ev:null,bridge_correction_ev:null,corrected_eads_ev:null,final_eads_ev:null,prediction_method:'NOT_AVAILABLE',calculation_status:'NOT_AVAILABLE',calibration_status:'NOT_CALIBRATED',dft_job_id:null,reference_source:null,validation_metrics:null,applicability_domain:'NOT_ESTABLISHED',uncertainty_ev:null,reason:substrate.description,model_id:null,model_version:null};
  try{
   if(substrate.id==='TiN'||substrate.id==='Al2O3'){
    if(substrate.id==='TiN'&&state.id!=='ORIGINAL'){row.reason='Selected research surface model is NOT READY. No fallback to another surface.';rows.push(row);continue;}
    const p=substrate.id==='TiN'?shared.prediction:shared.al2o3;
    if(typeof p?.raw_predicted_eads_ev!=='number')throw new Error(shared.errors[substrate.id==='TiN'?'tin':'al2o3']||'ORIGINAL_ENGINE_FAILED');
    Object.assign(row,{surface_model_id:p.surface_id,surface_model_version:p.model_version,raw_eads_ev:p.raw_predicted_eads_ev,bridge_correction_ev:p.bridge_correction_ev??null,corrected_eads_ev:p.corrected_eads_ev??null,final_eads_ev:p.corrected_eads_ev??null,prediction_method:'EXISTING_MODEL',calculation_status:'EXISTING_MODEL',calibration_status:p.calibration_status,model_id:p.model_id,model_version:p.model_version,reference_source:p.reference_dataset,validation_metrics:p.bridge_model?.validation??null,applicability_domain:p.universal_applicability_domain??p.applicability_domain,uncertainty_ev:p.uncertainty_ev??null,reason:p.bridge_reason||substrate.description});
    if(substrate.id==='Al2O3')Object.assign(row,{prediction_method:AL2O3_METHOD,calculation_status:AL2O3_METHOD,reason:'Existing hydroxylated α-Al₂O₃(0001) v1.2 screening model. No new DFT, OH coverage adjustment or extra hydroxylation correction.'});
   }else{
    if(!shared.geometry?.is_real_3d)throw new Error('REAL_MOLECULAR_GEOMETRY_UNAVAILABLE');
    const context=surfaceContext(state.model_id),theory=predictTheory(state.model_id,context.fingerprint,shared.universal_descriptors?.physical,loadTheoryModels());
    // Completed matching DFT has priority over a surrogate. A job is reusable only for the same identity/surface/settings fingerprint.
    const jobID=enqueue(substrate.id,state.model_id,shared.geometry);row.dft_job_id=jobID;const job=await readJob(jobID);
    if(job.result){Object.assign(row,{raw_eads_ev:job.result.eads_ev,final_eads_ev:job.result.eads_ev,prediction_method:'DFT_CALCULATED',calculation_status:'DFT_CALCULATED',calibration_status:'DFT_CONVERGENCE_VALIDATED',reference_source:job.result.provenance,model_id:state.model_id,model_version:state.version,reason:'Converged same-condition DFT. No literature clamping.'});}
    else if(theory.status==='THEORY_PREDICTED'){const m=theory.model;Object.assign(row,{raw_eads_ev:theory.eads_ev,final_eads_ev:theory.eads_ev,prediction_method:'THEORY_PREDICTED',calculation_status:'THEORY_PREDICTED',calibration_status:'INDEPENDENTLY_VALIDATED',reference_source:{dataset:m.dataset.id,sha256:m.dataset.sha256},validation_metrics:m.validation,applicability_domain:'IN_DOMAIN',uncertainty_ev:m.validation.rmse_ev,model_id:m.model_id,model_version:m.version,reason:'Surface-specific validated surrogate; not direct DFT. RMSE is a test error estimate, not a per-molecule confidence interval.'});}
    else{row.prediction_method='DFT_PENDING';row.calculation_status=job.status==='FAILED'?'CALCULATION_FAILED':theory.status==='OUT_OF_DOMAIN'?'OUT_OF_DOMAIN':'DFT_PENDING';row.reason=job.reason||context.reason;row.applicability_domain=theory.status==='OUT_OF_DOMAIN'?'OUT_OF_DOMAIN':'NOT_ESTABLISHED';}
   }
  }catch(e:any){row.calculation_status='CALCULATION_FAILED';row.reason=e.message;}
  rows.push(row);
 }
 const result={...shared,analysis_id:crypto.randomUUID(),s4_version:S4_VERSION,substrate_ids:body.substrates,four_substrate_results:rows,comparison_warning:'Cross-surface ranking is not quantitatively established: original energy reference definitions are unspecified. Missing values are not zero.'};
 saveAnalysis(result);return result;
}
export function saveAnalysis(result:any){const db=s4db(),time=new Date().toISOString(),stored={...result,history:undefined};db.exec('BEGIN');try{
 db.prepare('INSERT INTO s4_analyses VALUES(?,?,?,?,?) ON CONFLICT(analysis_id) DO UPDATE SET response_json=excluded.response_json').run(result.analysis_id,result.geometry?.isomeric_smiles||result.analysis?.molecular_identity?.canonical_smiles||'',result.geometry?.inchikey||result.analysis?.molecular_identity?.inchikey,time,JSON.stringify(stored));
 for(const row of result.four_substrate_results)db.prepare('INSERT OR REPLACE INTO s4_results VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(result.analysis_id,row.substrate_id,row.surface_state,row.surface_model_id,row.surface_model_version,row.prediction_method,row.raw_eads_ev,row.bridge_correction_ev,row.corrected_eads_ev,row.calibration_status,row.dft_job_id,row.calculation_status,JSON.stringify(row.reference_source),JSON.stringify(row.validation_metrics),time,JSON.stringify(row));
 db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
export async function retrieveAnalysis(id:string){const row=s4db().prepare('SELECT response_json FROM s4_analyses WHERE analysis_id=?').get(id) as any;if(!row)throw new Error('ANALYSIS_NOT_FOUND');const r=JSON.parse(row.response_json),previous=JSON.stringify(r);
 for(const result of r.four_substrate_results){if(!result.dft_job_id)continue;const job=await readJob(result.dft_job_id);if(job.result)Object.assign(result,{raw_eads_ev:job.result.eads_ev,final_eads_ev:job.result.eads_ev,prediction_method:'DFT_CALCULATED',calculation_status:'DFT_CALCULATED',calibration_status:'DFT_CONVERGENCE_VALIDATED',reference_source:job.result.provenance,reason:'Verified same-condition DFT result retrieved.'});else if(job.status==='FAILED'){result.calculation_status='CALCULATION_FAILED';result.reason=job.reason;}}
 if(JSON.stringify(r)!==previous)saveAnalysis(r);return hydrateAl2o3History(r);
}
