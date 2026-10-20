/** Selection only: no new energy/score formula, no SU/eV conversion. Shared with UI/CSV. */
export const AUTO_POLICY_VERSION='S5-AUTO-SELECTION-1.0.0';
export const FIXED_CONDITIONS:Record<string,string>={TiN:'ORIGINAL',Al2O3:'HYDROXYLATED',SiO2:'HYDROXYLATED',HMDS_SiO2:'DEFINED_COVERAGE'};
export const SURFACE_DEFINITIONS:Record<string,string>={TiN:'ORIGINAL_TIN_SCREENING_SURFACE',Al2O3:'HYDROXYLATED_ALPHA_AL2O3_0001',SiO2:'HYDROXYLATED_SIO2',HMDS_SiO2:'TMS_TERMINATED_SIO2'};
export const isGSurface=(id:string)=>['SiO2','HMDS_SiO2'].includes(id);
export function acceptedValidatedG(row:any){
 const proof=row.reference_source,c=row.thermodynamic_context;const required=['environment','temperature_k','standard_state','surface_model_id','morphology','facet','termination','silanol_density_nm2','hydration',...(row.substrate_id==='HMDS_SiO2'?['tms_coverage_nm2','residual_oh_nm2','polarity_definition','contact_accessibility','steric_definition']:[]),...(c?.environment==='SOLUTION_REFERENCE'?['solvent']:[])];const compatible=row.surface_state===FIXED_CONDITIONS[row.substrate_id]&&c?.surface_model_id===row.surface_model_id&&required.every(k=>c?.[k]!==null&&c?.[k]!==undefined);return compatible&& isGSurface(row.substrate_id)&&row.energy_type==='DELTA_G'&&row.energy_unit==='eV'&&typeof row.final_prediction_ev==='number'&&Number.isFinite(row.final_prediction_ev)&&row.validation_status==='INDEPENDENTLY_VALIDATED'&&row.calibration_status==='INDEPENDENTLY_VALIDATED'&&row.applicability_domain==='IN_DOMAIN'&&['VALIDATED_DELTA_G_MODEL','VALIDATED_SURFACE_TRANSFER'].includes(row.prediction_method)&&!!row.model_id&&!!row.model_version&&!!(proof?.review?.approved||proof?.transfer?.reference_source?.review?.approved);
}
export function automaticChoice(row:any){
 if(!isGSurface(row.substrate_id))return {prediction_type:'EADS',reason_code:row.substrate_id==='Al2O3'?'ORIGINAL_HYDROXYLATED_V12_ENGINE':'ORIGINAL_TIN_ENGINE',reason_zh:row.substrate_id==='Al2O3'?'採用原始羥基化 α-Al₂O₃(0001) v1.2 篩選引擎；未額外套用羥基化修正。':'採用原始 TiN TypeScript 篩選引擎，保留原始表面假設與數值。'};
 if(acceptedValidatedG(row))return {prediction_type:'DELTA_G_ADSORPTION',reason_code:'REVIEWED_VALIDATED_IN_DOMAIN_DELTA_G',reason_zh:'已有通過獨立驗證、表面及熱力學條件相符且位於適用範圍內的 ΔGads 模型。'};
 return {prediction_type:'HYPOTHETICAL_SCORE',reason_code:'NO_APPLICABLE_VALIDATED_DELTA_G_USE_EXISTING_SU',reason_zh:'目前沒有適用且通過獨立驗證的 ΔGads 模型，改採既有通用假設性吸附引擎；SU 不是真實吸附自由能。'};
}
