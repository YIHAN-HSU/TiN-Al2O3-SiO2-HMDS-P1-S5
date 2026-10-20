export interface FluorineDescriptors {
 descriptor_id:string; descriptor_version:string; source_inchikey:string; has_fluorine:boolean;
 f_atom_count:number; fluorinated_carbon_count:number; f_c_ratio:number|null;
 classification:Record<string,number>; aromatic_cf3_count:number; [key:string]:unknown;
}
export interface AnalyzeRequest {
 input_type:'SMILES'|'InChI'|'MDL'|'IMAGE'; raw_text?:string; selected_mol_block?:string; candidate_smiles?:string;
 candidate_confirmed?:boolean; mode?:'DUAL'|'TIN_ONLY'|'AL2O3_ONLY';
}
export interface CorrectionModel {
 model_id:string; version:string; surface_id:string; enabled:boolean;
 validation:{status:'VALIDATED'; evidence:string; independent_dataset:string; n_test:number; mae_ev:number; acceptance_mae_ev:number};
 calibration_dataset:{id:string; provenance:string; sha256:string; training_identity_keys:string[]};
 applicability_domain:{identity_keys:string[]; surface_assumptions:string};
 correction_method:'EXACT_IDENTITY_RESIDUAL'; original_model_id:string; original_formula_hash:string;
 energy_reference:string; energy_definition:string;
 entries:{identity_key:string; original_eads_ev:number; delta_ev:number}[];
}
export interface FluorineCorrection {
 original_eads_ev:number; fluorine_correction_ev:number|null; corrected_eads_ev:number|null;
 displayed_eads_ev:number; fluorine_status:'NOT_CALIBRATED'|'CALIBRATED'|'NOT_APPLICABLE'|'ANALYSIS_UNAVAILABLE';
 correction_model:Omit<CorrectionModel,'entries'>|null;
 fluorine:FluorineDescriptors|null; correction_reason:string; correction_adapter_version:string;
}
// No compatible validated paired dataset was retrieved. Never accept models from API requests.
export const VALIDATED_F_MODELS:readonly CorrectionModel[]=Object.freeze([]);
export function applyFluorineCorrection(original:any,f:FluorineDescriptors|null,models:readonly CorrectionModel[]=VALIDATED_F_MODELS):FluorineCorrection {
 const raw=original.raw_predicted_eads_ev;
 const base:FluorineCorrection={original_eads_ev:raw,fluorine_correction_ev:null,corrected_eads_ev:null,displayed_eads_ev:raw,
  fluorine_status:!f?'ANALYSIS_UNAVAILABLE':f.has_fluorine?'NOT_CALIBRATED':'NOT_APPLICABLE',correction_model:null,fluorine:f,
  correction_reason:!f?'RDKit descriptors unavailable; no correction applied.':'No applicable validated surface-specific correction model.',correction_adapter_version:'P1F-1.0.0'};
 if(!Number.isFinite(raw)||!f?.has_fluorine||f.source_inchikey!==original.source_inchikey)return base;
 const applicable=models.filter(m=>m.enabled&&m.validation?.status==='VALIDATED'&&m.model_id&&m.version&&
  m.validation.evidence&&m.validation.independent_dataset&&m.validation.independent_dataset!==m.calibration_dataset?.id&&
  Number.isInteger(m.validation.n_test)&&m.validation.n_test>0&&Number.isFinite(m.validation.mae_ev)&&m.validation.mae_ev>=0&&
  Number.isFinite(m.validation.acceptance_mae_ev)&&m.validation.acceptance_mae_ev>0&&m.validation.mae_ev<=m.validation.acceptance_mae_ev&&
  m.calibration_dataset?.provenance&&/^[a-f0-9]{64}$/i.test(m.calibration_dataset.sha256)&&
  !m.calibration_dataset.training_identity_keys.includes(f.source_inchikey)&&
  m.surface_id===original.surface_id&&m.original_model_id===original.model_id&&m.original_formula_hash===original.formula_hash&&
  m.applicability_domain?.identity_keys.includes(f.source_inchikey)&&m.applicability_domain.surface_assumptions===original.surface_assumptions&&
  m.energy_reference!=='NOT SPECIFIED'&&m.energy_definition!=='NOT SPECIFIED'&&m.energy_reference===original.energy_reference&&m.energy_definition===original.energy_definition&&
  m.correction_method==='EXACT_IDENTITY_RESIDUAL');
 if(applicable.length!==1)return base;
 const m=applicable[0],entries=m.entries.filter(e=>e.identity_key===f.source_inchikey&&e.original_eads_ev===raw&&Number.isFinite(e.delta_ev)&&Number.isFinite(raw+e.delta_ev));
 if(entries.length!==1)return base;
 const {entries:_,...provenance}=m;
 return {...base,fluorine_correction_ev:entries[0].delta_ev,corrected_eads_ev:raw+entries[0].delta_ev,displayed_eads_ev:raw+entries[0].delta_ev,
  fluorine_status:'CALIBRATED',correction_model:provenance,correction_reason:'Validated exact-identity residual; no additional MW/TPSA/logP contribution.'};
}
