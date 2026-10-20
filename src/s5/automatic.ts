import {applyHypothetical} from './hypothetical';import {AUTO_POLICY_VERSION,automaticChoice,isGSurface} from './automaticPolicy';
/** Non-destructive history hydration. Original scientific rows and stored SQLite JSON remain intact. */
export async function ensureAutomatic(result:any,options:any={}){
 const needs=(result.four_substrate_results||[]).some((r:any)=>isGSurface(r.substrate_id)&&automaticChoice(r).prediction_type==='HYPOTHETICAL_SCORE');
 if(needs&&!result.hypothetical){
  const previous=result.prediction_mode;
  try{await applyHypothetical(result,{prediction_mode:'HYPOTHETICAL_SIMULATION',hypothetical_assumption_set:options.hypothetical_assumption_set||'BASELINE',hypothetical_parameter_overrides:options.hypothetical_parameter_overrides||{}});}
  catch(e:any){result.automatic_model_errors={hypothetical:e.message};}
  finally{result.prediction_mode=previous;}
 }
 result.model_selection='AUTOMATIC';result.model_selection_version=AUTO_POLICY_VERSION;
 result.model_selections=(result.four_substrate_results||[]).map((r:any)=>({substrate_id:r.substrate_id,...automaticChoice(r)}));
 return result;
}
