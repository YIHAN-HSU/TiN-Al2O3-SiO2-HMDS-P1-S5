export type NumericalProfile='USER_SURFACE'|'R2007_403K'|'R2007_423K';
export interface HybridSurfaceResult {
 value_ev:number|null;uncertainty_ev:number|null;prediction_method:string;validation_status:string;reason:string;reason_codes:string[];high_uncertainty:boolean;uncertainty_status:string;hybrid_diagnostics:Record<string,unknown>;
 [metadata:string]:any;
}
export interface HybridResponse {
 SiO2:HybridSurfaceResult;HMDS_SiO2:HybridSurfaceResult;
 hybrid:{version:string;descriptors:Record<string,any>;dataset_counts:Record<string,number>;transfer:Record<string,any>;prediction_trace:Record<string,any>[];unknown_monomer?:{id:string;version:string;surfaces:Record<string,UnknownMonomerSurface>}};
 delta_delta_g?:Record<string,any>;literature_references?:Record<string,any>[];
}
export interface UnknownMonomerSurface {
 model_id:string;version:string;prediction_level:string;predicted_delta_g_ev:number|null;uncertainty_ev:number|null;uncertainty_definition:string;
 similar_reference_molecules:Array<{id:string;molecule:string;smiles:string;tanimoto:number;compatible:boolean;compatibility_reason:string;temperature_k:number;reference_value_ev:number;doi:string;verification_status:string;surface_model:string;energy_type:string;standard_state:string}>;
 missing_quantitative_basis:string[];applicability_domain:Record<string,any>;surface_conditions:Record<string,any>;training_data_provenance:Record<string,any>;relative_evidence:Record<string,any>;
}
