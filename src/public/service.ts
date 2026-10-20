import {execFile} from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import {integratedAnalyze,v12} from '../integration/service';
import {withMemoryDatabase} from '../db/database';
import {ensureAutomatic} from '../s5/automatic';
import {projectResults} from '../s5/resultsView';
import {FIXED_CONDITIONS} from '../s5/automaticPolicy';
const ids=['TiN','Al2O3','SiO2','HMDS_SiO2'];
export class PublicError extends Error {constructor(public code:string,public status=400){super(code);}}
export function worker(payload:any){return new Promise<any>((resolve,reject)=>{const child=execFile(process.env.PYTHON_EXECUTABLE||'python3',[path.resolve('backend/public_worker.py')],{timeout:30000,maxBuffer:8*1024*1024,encoding:'utf8'},(e,out)=>{try{const r=JSON.parse(out);if(e)throw Error('WORKER_FAILED');resolve(r);}catch{reject(new PublicError('MOLECULAR_ANALYSIS_FAILED',422));}});child.stdin!.end(JSON.stringify(payload));});}
export async function publicAnalyze(body:any){
 if(!body||!['SMILES','InChI','MDL'].includes(body.input_type))throw new PublicError('INVALID_INPUT_TYPE');
 const input=body.selected_mol_block??body.raw_text;
 if(typeof input!=='string'||!input.trim())throw new PublicError('EMPTY_INPUT');
 if(input.length>50000)throw new PublicError('INPUT_TOO_LARGE',413);
 if(!Array.isArray(body.substrates)||!body.substrates.length||body.substrates.length>4||new Set(body.substrates).size!==body.substrates.length||body.substrates.some((s:any)=>!ids.includes(s)))throw new PublicError('INVALID_SUBSTRATES');
 const allowed=await worker({input_type:body.selected_mol_block?'MDL':body.input_type,input_data:input,maximum_heavy_atoms:80});
 if(!allowed.ok)throw new PublicError(allowed.code||'INVALID_MOLECULE',422);
 return withMemoryDatabase(async()=>{
  const tin=body.substrates.includes('TiN'),al=body.substrates.includes('Al2O3');
  const safe:any={input_type:body.selected_mol_block?'MDL':body.input_type,raw_text:input,mode:tin&&al?'DUAL':tin?'TIN_ONLY':'AL2O3_ONLY'};
  let shared:any;
  if(tin||al)shared=await integratedAnalyze(safe);
  else {const geometry=await v12({input_type:safe.input_type.toLowerCase(),input_data:input,prediction_enabled:false});shared={geometry,fluorine:geometry.fluorine,universal_descriptors:geometry.universal_descriptors,universal_structure:geometry.universal_structure,bridge_descriptors:geometry.bridge_descriptors,prediction:null,al2o3:null,errors:{}};}
  if(shared.geometry?.status!=='SUCCESS'||tin&&!Number.isFinite(shared.prediction?.raw_predicted_eads_ev)||al&&!Number.isFinite(shared.al2o3?.raw_predicted_eads_ev))throw new PublicError('MOLECULAR_ANALYSIS_FAILED',422);
  const rows=body.substrates.map((id:string)=>{const p=id==='TiN'?shared.prediction:id==='Al2O3'?shared.al2o3:null;const raw=p?.raw_predicted_eads_ev??null;
   return {substrate_id:id,surface_state:FIXED_CONDITIONS[id],surface_model_id:p?.surface_id??(id==='SiO2'?'S4_SIO2_OH_WAFER_V1':'S4_HMDS_SIO2_DEFINED_V1'),energy_type:p?'EADS':'DELTA_G',energy_unit:'eV',raw_eads_ev:raw,raw_prediction_ev:raw,bridge_correction_ev:null,corrected_eads_ev:null,final_prediction_ev:raw,final_eads_ev:raw,model_id:p?.model_id??null,model_version:p?.model_version??null,prediction_method:p?(id==='Al2O3'?'EXISTING_V1.2_SCREENING_MODEL':'EXISTING_MODEL'):'NOT_AVAILABLE',calculation_status:p?(id==='Al2O3'?'EXISTING_V1.2_SCREENING_MODEL':'EXISTING_MODEL'):'NOT_AVAILABLE',validation_status:p?'EXISTING_SCREENING_MODEL':'NOT_VALIDATED',calibration_status:'NOT_CALIBRATED',applicability_domain:'NOT_ESTABLISHED',uncertainty_ev:null,reason:p?'原始篩選模型；未新增表面 DFT 或校正。':'目前沒有適用且經獨立驗證的吸附自由能模型，使用既有 SU 假設情境。'};});
  const result:any={...shared,analysis_id:crypto.randomUUID(),s5_version:'P1-S5-PUBLIC-1.0.0',public_mode:true,substrate_ids:body.substrates,four_substrate_results:rows,transparency:shared.transparency||[],history:undefined,analysis:null,errors:{},poor_co_feature_status:'DISABLED'};
  if(body.substrates.some((s:string)=>s==='SiO2'||s==='HMDS_SiO2'))result.hybrid={descriptors:await worker({action:'descriptors',smiles:shared.geometry.isomeric_smiles,geometry:shared.geometry})};
  await ensureAutomatic(result);
  if(rows.some((r:any)=>r.energy_type==='DELTA_G'&&!Number.isFinite(result.hypothetical?.surfaces?.[r.substrate_id]?.score_su)))throw new PublicError('SCENARIO_ENGINE_FAILED',503);
  for(const key of ['prediction','al2o3']){const p=result[key];if(p)result[key]=Object.fromEntries(['model_id','model_version','surface_id','raw_predicted_eads_ev','energy_unit','dft_status','calibration_status','confidence'].map(k=>[k,p[k]]));}
  if(result.hypothetical){const h=result.hypothetical;result.hypothetical={version:h.version,status:h.status,surfaces:h.surfaces,surface_difference:h.surface_difference};}
  result.geometry=Object.fromEntries(['status','formula','molecular_weight','isomeric_smiles','canonical_smiles','inchi','inchikey','formal_charge','output_3d_inchikey','svg_depiction','atoms','bonds','mol_block','is_real_3d','conformer_engine','conformer_energy','energy_unit','geometry_error'].map(k=>[k,shared.geometry[k]]));
  result.comparison=undefined;
  result.integrated_results=projectResults(result);
  return result;
 });
}
