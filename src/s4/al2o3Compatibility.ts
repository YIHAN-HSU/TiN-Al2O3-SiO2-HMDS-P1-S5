import {AL2O3_ENGINE_ID,AL2O3_SURFACE_ID,AL2O3_METHOD,canonicalSurfaceState} from './registry';
import {v12,comparison} from '../integration/service';
import {applyUniversalIntegration} from '../integration/universalBridge';
/** Presentation compatibility is non-destructive: original SQLite JSON is retained verbatim. */
export async function hydrateAl2o3History(result:any){
 const row=result.four_substrate_results?.find((r:any)=>r.substrate_id==='Al2O3');if(!row)return result;
 if(row.surface_state==='HYDROXYLATED'&&row.surface_model_id===AL2O3_SURFACE_ID&&row.model_id===AL2O3_ENGINE_ID&&row.prediction_method===AL2O3_METHOD)return result;
 const canonical=canonicalSurfaceState('Al2O3',row.surface_state);
 if(canonical!=='HYDROXYLATED')return result; // Do not reinterpret legacy dry-surface research.
 const original={surface_state:row.surface_state,surface_model_id:row.surface_model_id,prediction_method:row.prediction_method,raw_eads_ev:row.raw_eads_ev};
 let recalculated=false;
 if(typeof row.raw_eads_ev!=='number'){
  const smiles=result.geometry?.isomeric_smiles;
  if(!smiles){row.reason='LEGACY_OH_HISTORY_REQUIRES_REANALYSIS: stored molecular identity is missing.';return result;}
  // The old OH research option skipped the original engine. Compute it now, never invent a historical value.
  const g=await v12({input_type:'smiles',input_data:smiles,prediction_enabled:true});
  if(g.status!=='SUCCESS'||g.inchikey!==result.geometry.inchikey||typeof g.ai_prediction?.raw_predicted_eads_ev!=='number')throw new Error('LEGACY_AL2O3_V12_REANALYSIS_FAILED');
  const al={...g.ai_prediction,energy_unit:'eV'};Object.assign(al,applyUniversalIntegration(al,g.fluorine,g.bridge_descriptors,g.universal_structure,g.universal_descriptors));
  result.al2o3=al;Object.assign(row,{raw_eads_ev:al.raw_predicted_eads_ev,bridge_correction_ev:al.bridge_correction_ev??null,corrected_eads_ev:al.corrected_eads_ev??null,calibration_status:al.calibration_status,applicability_domain:al.universal_applicability_domain??al.applicability_domain,uncertainty_ev:al.uncertainty_ev??null});
  result.comparison=comparison(result.prediction,al);
  const keys:any={OH:'OH',COOH:'COOH',carbonyl:'Carbonyl',ester:'Ester',ether:'Ether',amine:'Amine',amide:'Amide',nitrile:'Nitrile',aromatic_ring:'Aromatic',alkene_cc:'C=C'};
  const terms:any={OH:'e_oh',COOH:'e_cooh',carbonyl:'e_carbonyl',ester:'e_ester',ether:'e_ether',amine:'e_amine',amide:'e_amide',nitrile:'e_nitrile',aromatic_ring:'e_aromatic',alkene_cc:'e_ene'};
  for(const t of result.transparency||[])Object.assign(t,{al2o3_actual_count:al.features?.fg_counts?.[keys[t.group]]??null,al2o3_effective_count:al.effective_counts?.[terms[t.group]]??null,al2o3_contribution_ev:al.functional_group_contributions?.[terms[t.group]]??null,al2o3_expression:al.contribution_expressions?.[terms[t.group]]??null});
  if(result.errors)delete result.errors.al2o3;recalculated=true;
 }
 Object.assign(row,{surface_state:'HYDROXYLATED',surface_model_id:AL2O3_SURFACE_ID,surface_model_version:'v1.2',model_id:AL2O3_ENGINE_ID,model_version:'v1.2',prediction_method:AL2O3_METHOD,calculation_status:AL2O3_METHOD,final_eads_ev:row.corrected_eads_ev??row.raw_eads_ev,reason:'Existing hydroxylated α-Al₂O₃(0001) v1.2 screening model; not newly executed DFT.'});
 if(result.s5_version)Object.assign(row,{energy_type:'Eads',energy_unit:'eV',raw_prediction_ev:row.raw_eads_ev,final_prediction_ev:row.corrected_eads_ev??row.raw_eads_ev,final_source:row.corrected_eads_ev!=null?'VALIDATED_BRIDGE':'ORIGINAL_MODEL',validation_status:AL2O3_METHOD});
 if(result.al2o3)Object.assign(result.al2o3,{surface_state:'HYDROXYLATED',prediction_method:AL2O3_METHOD,surface_model_version:'v1.2'});
 if(result.geometry?.ai_prediction)Object.assign(result.geometry.ai_prediction,{surface_state:'HYDROXYLATED',prediction_method:AL2O3_METHOD,surface_model_version:'v1.2'});
 if(result.input_surface_conditions)result.input_surface_conditions={...result.input_surface_conditions,Al2O3:'HYDROXYLATED'};
 if(recalculated||original.surface_state!=='HYDROXYLATED')result.surface_compatibility={...result.surface_compatibility,Al2O3:{original,canonical_surface_state:'HYDROXYLATED',canonical_surface_model_id:AL2O3_SURFACE_ID,engine_model_id:AL2O3_ENGINE_ID,recalculated_on_read:recalculated,stored_record_modified:false,reason:recalculated?'Legacy research selection skipped v1.2; a fresh v1.2 screening calculation is returned, not a historical measurement.':'Legacy hydroxylated alias mapped; stored energy is unchanged.'}};
 return result;
}
