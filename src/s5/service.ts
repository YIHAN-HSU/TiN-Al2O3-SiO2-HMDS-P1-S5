import fs from 'node:fs';import path from 'node:path';import {execFile} from 'node:child_process';import {analyzeFour as analyzeElectronic,type FourRequest} from '../s4/service';import {s4db} from '../s4/store';import {applyNumerical} from './numericalAdapter';
import {context,contextGaps,lookup,predictG,transfer,unavailable,sameThermo,loadModels,type ThermoContext,type GResult} from './thermodynamics';import {SUBSTRATES} from '../s4/registry';
import {calculatedG} from './calculated';
import {applyHypothetical,validateHypothetical,type HypotheticalRequest} from './hypothetical';
import {projectResults} from './resultsView';
import {hydrateAl2o3History} from '../s4/al2o3Compatibility';
import {AL2O3_METHOD} from '../s4/registry';
// Deprecated request field is accepted for client compatibility; no Poor Co runtime import.
import type {PoorCoRequest} from '../poorCo/schema';
import {ensureAutomatic} from './automatic';import {FIXED_CONDITIONS} from './automaticPolicy';
export interface S5Request extends FourRequest,HypotheticalRequest {model_selection?:'AUTOMATIC';thermodynamic_contexts?:Record<string,Partial<ThermoContext>>;numerical_profile?:import('./hybridTypes').NumericalProfile;poor_co?:PoorCoRequest;}
function database(){const root=fs.realpathSync(process.cwd());if(path.basename(root)!=='TiN-Al2O3-SiO2-HMDS-P1-S5-Final-Integrated'||!fs.existsSync('validation/s5/isolation.json'))throw new Error('S5_ISOLATION_REQUIRED');const db=s4db();db.exec(`CREATE TABLE IF NOT EXISTS s5_analyses(analysis_id TEXT PRIMARY KEY,created_at TEXT NOT NULL,smiles TEXT NOT NULL,identity_key TEXT NOT NULL,response_json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS s5_schema(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);INSERT OR IGNORE INTO s5_schema VALUES(1,datetime('now'));`);return db;}
async function fingerprint(smiles:string){return new Promise<any>((resolve,reject)=>{const child=execFile(process.env.PYTHON_EXECUTABLE||'python',[path.resolve('backend/s5_fingerprint.py')],{timeout:30000,maxBuffer:2*1024*1024,encoding:'utf8'},(err,out)=>{if(err)return reject(new Error('FINGERPRINT_FAILED'));try{resolve(JSON.parse(out));}catch{reject(new Error('INVALID_FINGERPRINT_JSON'));}});child.stdin!.end(JSON.stringify({smiles}));});}
export function save(result:any){const stored={...result,history:undefined};database().prepare('INSERT INTO s5_analyses VALUES(?,?,?,?,?)').run(result.analysis_id,new Date().toISOString(),result.geometry.isomeric_smiles,result.geometry.inchikey,JSON.stringify(stored));}
export function history(){return database().prepare('SELECT analysis_id,created_at,smiles,identity_key FROM s5_analyses ORDER BY created_at DESC LIMIT 200').all();}
export async function retrieve(id:string){const row=database().prepare('SELECT response_json FROM s5_analyses WHERE analysis_id=?').get(id) as any;if(!row)throw new Error('ANALYSIS_NOT_FOUND');const result=await hydrateAl2o3History(JSON.parse(row.response_json));await ensureAutomatic(result);return {...result,integrated_results:projectResults(result)};}
export async function analyzeFour(body:S5Request){
 // Strip the retired feature before passing the request into any analysis stage.
 const {poor_co:_retiredPoorCo,...adsorptionRequest}=body;body=adsorptionRequest;
 const auto=body.model_selection==='AUTOMATIC'||body.prediction_mode===undefined;
 if(auto)body={...body,prediction_mode:'SCIENTIFIC_PREDICTION',surface_conditions:FIXED_CONDITIONS,numerical_profile:'USER_SURFACE'};
 validateHypothetical(body);
 // Retain the existing shared parse, original engines, Eads DFT workflow and error handling.
 // Existing SiO2/HMDS Eads artifacts become an auxiliary electronic stage, never Gibbs energy.
 const result:any=await analyzeElectronic(body),identity=result.geometry.inchikey;
 result.molecular_fingerprint=await fingerprint(result.geometry.isomeric_smiles);if(result.molecular_fingerprint.inchikey!==identity)throw new Error('FINGERPRINT_IDENTITY_MISMATCH');
 const defaults=JSON.parse(fs.readFileSync('models/s5/contexts.json','utf8'));
 const contexts:Record<string,ThermoContext>={};for(const id of ['SiO2','HMDS_SiO2'])contexts[id]=context({...defaults[id],...body.thermodynamic_contexts?.[id]});
 const physical=result.universal_descriptors?.physical;
 function direct(id:string):GResult{const gaps=contextGaps(contexts[id],id==='HMDS_SiO2');if(gaps.length)return unavailable(gaps.join('; '));const spec=SUBSTRATES.find(s=>s.id===id)!,state=spec.states.find(s=>s.id===((body.surface_conditions as Record<string,string>|undefined)?.[id]||spec.states[0].id));if(!state||contexts[id].surface_model_id!==state.model_id)return unavailable('SELECTED_SURFACE_AND_THERMODYNAMIC_MODEL_MISMATCH');const actual=calculatedG(identity,id,contexts[id]);if(actual.value_ev!==null)return actual;const predicted=predictG(id,contexts[id],physical);if(predicted.value_ev!==null)return predicted;return id==='HMDS_SiO2'?unavailable('VALIDATED_SURFACE_TRANSFER_REQUIRED'):lookup(identity,id,contexts[id]);}
 // Internal SiO2 baseline is permitted for HMDS-only; it never changes visible selections.
 let baseline:GResult|undefined;const getBaseline=()=>baseline??(baseline=direct('SiO2'));
 const rows=result.four_substrate_results.map((old:any)=>{
  const eads=['TiN','Al2O3'].includes(old.substrate_id);
  if(eads){const final=old.corrected_eads_ev??old.raw_eads_ev;return {...old,energy_type:'Eads',energy_unit:'eV',raw_prediction_ev:old.raw_eads_ev,final_prediction_ev:final,final_eads_ev:final,delta_g_ev:null,delta_delta_g_ev:null,baseline_sio2_delta_g_ev:null,final_source:old.corrected_eads_ev!==null?'VALIDATED_BRIDGE':'ORIGINAL_MODEL',validation_status:old.substrate_id==='Al2O3'?AL2O3_METHOD:'EXPLORATORY_ORIGINAL_MODEL',thermodynamic_context:null,gaps:[]};}
  const id=old.substrate_id,c=contexts[id];let value=direct(id),delta=unavailable('NO_VALIDATED_SURFACE_TRANSFER'),base:GResult|undefined;
  if(id==='HMDS_SiO2'&&value.value_ev===null&&contextGaps(c,true).length===0&&c.surface_model_id===old.surface_model_id){
   base=getBaseline();delta=predictG(id,c,physical,'SURFACE_TRANSFER');
   if(delta.value_ev!==null){const models=loadModels().filter((m:any)=>m.id===delta.model_id&&m.version===delta.model_version);if(models.length===1&&JSON.stringify(context(models[0].baseline_context))===JSON.stringify(contexts.SiO2))value=transfer(base,delta,contexts.SiO2,c,models[0].covariance_ev2??null,models[0].uncertainty_assumption??null);else value=unavailable('TRANSFER_BASELINE_SURFACE_CONTEXT_MISMATCH');}
  }
  if(id==='HMDS_SiO2'&&value.value_ev===null){const reference=lookup(identity,id,c);if(reference.value_ev!==null)value=reference;}
  return {...old,final_source:value.value_ev!==null?value.prediction_method:null,energy_type:'DELTA_G',energy_unit:'eV',auxiliary_electronic_stage:{eads_ev:old.raw_eads_ev,status:old.calculation_status,job_id:old.dft_job_id,energy_type:'DFT_EADS',warning:'Eads alone is not Gibbs free energy. Frequency/thermal/entropy/standard-state/solvation corrections and reviewed compatible surface context are required.'},raw_eads_ev:null,final_eads_ev:null,bridge_correction_ev:null,corrected_eads_ev:null,raw_prediction_ev:value.value_ev,final_prediction_ev:value.value_ev,delta_g_ev:value.value_ev,delta_delta_g_ev:value.value_ev!==null?delta.value_ev:null,baseline_sio2_delta_g_ev:base?.value_ev??null,baseline_sio2:base??null,prediction_method:value.prediction_method,calculation_status:value.value_ev===null?'QUANTITATIVE_PREDICTION_NOT_READY':'AVAILABLE',calibration_status:value.value_ev===null?'NOT_CALIBRATED':value.validation_status,validation_status:value.validation_status,reference_source:value.reference_source,validation_metrics:value.reference_source?.validation??null,model_id:value.model_id,model_version:value.model_version,applicability_domain:value.applicability_domain,uncertainty_ev:value.uncertainty_ev,reason:value.reason,thermodynamic_context:c,free_energy_workflow_status:'DELTA_G_NOT_COMPLETED',gaps:contextGaps(c,id==='HMDS_SiO2').concat(value.value_ev===null?['NO_VALIDATED_TOTAL_DELTA_G_MODEL_OR_COMPATIBLE_REFERENCE']:[])};
 });
 const si=rows.find((r:any)=>r.substrate_id==='SiO2'),hm=rows.find((r:any)=>r.substrate_id==='HMDS_SiO2');
 const compatible=si&&hm&&si.final_prediction_ev!==null&&hm.final_prediction_ev!==null&&sameThermo(contexts.SiO2,contexts.HMDS_SiO2);
 if(compatible&&hm.delta_delta_g_ev===null)hm.delta_delta_g_ev=hm.final_prediction_ev-si.final_prediction_ev;
 result.delta_delta_g={energy_type:'DELTA_DELTA_G',definition:'G_HMDS_MINUS_G_SIO2',value_ev:compatible?hm.final_prediction_ev-si.final_prediction_ev:null,status:compatible?'AVAILABLE':'NOT_AVAILABLE',reason:compatible?'Difference of available compatible total Gibbs energies; auxiliary, not a fifth substrate.':'Both selected surfaces need valid total ΔG and compatible temperature, standard state and environment.'};
 result.four_substrate_results=rows;result.s5_version='P1-S5-1.0';result.comparison_warning='TiN / Al₂O₃ Eads and SiO₂ / HMDS ΔG are different energy types. No mixed ranking. Gas-phase references do not establish solution residue or soaking behavior.';result.thermodynamic_contexts=contexts;
 await applyNumerical(result,body);if(auto)await ensureAutomatic(result,body);else await applyHypothetical(result,body);result.poor_co_feature_status='DISABLED';result.integrated_results=projectResults(result);save(result);return result;
}

