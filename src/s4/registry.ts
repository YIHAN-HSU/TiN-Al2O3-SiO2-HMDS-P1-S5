export const S4_VERSION='P1-S4-1.0.0';
export type SubstrateID='TiN'|'Al2O3'|'SiO2'|'HMDS_SiO2';
export interface SurfaceState {id:string;label:string;model_id:string;engine_model_id?:string;version:string;readiness:'EXISTING_MODEL'|'DEFINITION_REQUIRED'|'NOT_READY';}
export const AL2O3_SURFACE_ID='AL2O3_HYDROXYLATED_ALPHA_0001_ZIP12';
export const AL2O3_ENGINE_ID='AL2O3_ZIP12_GC_V1.2';
export const AL2O3_METHOD='EXISTING_V1.2_SCREENING_MODEL';
export const AL2O3_LEGACY_OH_IDS=['ORIGINAL','OH_RESEARCH','S4_AL2O3_OH_RESEARCH_V1',AL2O3_SURFACE_ID,AL2O3_ENGINE_ID,'AL2O3_ALPHA_OH_V01'];
/** Only hydroxylated aliases are equivalent. Dry research is never relabelled as hydroxylated data. */
export function canonicalSurfaceState(substrate:string,id?:string){return substrate==='Al2O3'&&(!id||AL2O3_LEGACY_OH_IDS.includes(id))?'HYDROXYLATED':id;}
export function selectionConditions(conditions:Record<string,string>={}){return {...conditions,Al2O3:'HYDROXYLATED'};}
const state=(id:string,label:string,model_id:string,readiness:SurfaceState['readiness']='NOT_READY'):SurfaceState=>({id,label,model_id,readiness,version:'1.0.0'});
export const SUBSTRATES:{id:SubstrateID;label:string;states:SurfaceState[];description:string}[]=[
 {id:'TiN',label:'TiN',description:'Original oxidized/hydroxylated TiN screening engine; original assumptions preserved.',states:[state('ORIGINAL','Original TiN Model','TIN_OXOH_V01','EXISTING_MODEL'),state('OXIDIZED_RESEARCH','Oxidized TiN · research / NOT READY','S4_TIN_OXIDIZED_RESEARCH_V1')]},
 {id:'Al2O3',label:'Al₂O₃',description:'Hydroxylated α-Al₂O₃(0001) — v1.2 Eads Screening Model. Fixed surface; OH coverage is not an adjustable model parameter. Existing screening estimate, not newly executed DFT.',states:[{...state('HYDROXYLATED','Hydroxylated α-Al₂O₃(0001) — v1.2 Eads Screening Model',AL2O3_SURFACE_ID,'EXISTING_MODEL'),version:'v1.2',engine_model_id:AL2O3_ENGINE_ID}]},
 {id:'SiO2',label:'SiO₂ Wafer',description:'Hydroxylated oxide wafer research specification. Morphology, facet, silanol density, hydration and atomistic slab require confirmation; quartz is not silently substituted.',states:[state('HYDROXYLATED','Hydroxylated SiO₂ · definition required','S4_SIO2_OH_WAFER_V1','DEFINITION_REQUIRED'),state('DEHYDROXYLATED','Dehydroxylated SiO₂ · research / NOT READY','S4_SIO2_DRY_WAFER_V1')]},
 {id:'HMDS_SiO2',label:'HMDS-treated SiO₂',description:'SiO₂ with covalently attached trimethylsilyl termination, not an HMDS molecular crystal. TMS coverage and residual silanol are unspecified until confirmed.',states:[state('DEFINED_COVERAGE','Defined HMDS Coverage · definition required','S4_HMDS_SIO2_DEFINED_V1','DEFINITION_REQUIRED'),state('PARTIAL_COVERAGE','Partial HMDS Coverage · NOT READY','S4_HMDS_SIO2_PARTIAL_V1'),state('HIGH_COVERAGE','High HMDS Coverage · NOT READY','S4_HMDS_SIO2_HIGH_V1')]}
];
export interface SurfaceResult {
 substrate_id:SubstrateID;surface_state:string;surface_model_id:string;surface_model_version:string;
 raw_eads_ev:number|null;bridge_correction_ev:number|null;corrected_eads_ev:number|null;final_eads_ev:number|null;
 prediction_method:string;calculation_status:string;calibration_status:string;dft_job_id:string|null;
 reference_source:any;validation_metrics:any;applicability_domain:any;uncertainty_ev:number|null;reason:string;model_id:string|null;model_version:string|null;
}
