import {applyBridge,applyBridgeIntegration,bridgeFeatures,validateBridgeModel,type BridgeDescriptors,type BridgeModel} from './bridge';
import type {FluorineDescriptors} from './fluorine';
export interface UniversalStructure {
 analysis_id:string;analysis_version:string;status:string;source_inchikey:string;
 summary:Record<string,number>;features:Record<string,{count:number;definition:string;occurrences:{id:string;atom_indices:number[]}[]}>;
 carbon_chains:any;rings:any[];overlap_relationships:any[];functional_group_relations:any[];[key:string]:unknown;
}
export interface UniversalBridgeModel extends BridgeModel {
 universal_structure_version:string;universal_descriptor_id:'P1G_UNIVERSAL_B';
}
export const UNIVERSAL_BRIDGE_VERSION='P1-G-UNIVERSAL-1.0.0';
export const TIN_UNIVERSAL_MODELS:readonly UniversalBridgeModel[]=Object.freeze([]);
export const AL2O3_UNIVERSAL_MODELS:readonly UniversalBridgeModel[]=Object.freeze([]);
export function universalModelDescriptors(s:UniversalStructure,b:BridgeDescriptors):BridgeDescriptors {
 // Explicit numeric graph covariates for a VALIDATED residual model, never assumed energy terms.
 const structural=Object.fromEntries(Object.entries(s.summary).filter(([,n])=>Number.isFinite(n)).map(([name,n])=>['structural_'+name+'_count',n]));
 return {...b,physical:{...b.physical,...structural}};
}
export function applyUniversalBridge(original:any,f:FluorineDescriptors|null,s:UniversalStructure|null,b:BridgeDescriptors|null,models?:readonly UniversalBridgeModel[]){
 const validIdentity=!!s&&s.status==='SUCCESS'&&s.source_inchikey===original.source_inchikey&&!!b&&b.source_inchikey===s.source_inchikey;
 const registry=models||(original.surface_id?.startsWith('TIN_')?TIN_UNIVERSAL_MODELS:original.surface_id?.startsWith('AL2O3_')?AL2O3_UNIVERSAL_MODELS:[]);
 const validModels=validIdentity?registry.filter(m=>m.universal_structure_version===s!.analysis_version&&m.universal_descriptor_id===b!.descriptor_id&&validateBridgeModel(m)):[];
 const view=validIdentity?universalModelDescriptors(s!,b!):null;
 const result=applyBridge(original,f,view,validModels);
 const accepted=result.bridge_status==='CALIBRATED';
 const compatible=validModels.filter(m=>m.surface_id===original.surface_id&&m.surface_assumptions===original.surface_assumptions&&m.original_model.model_id===original.model_id&&m.original_model.formula_hash===original.formula_hash&&m.energy_reference===original.energy_reference&&m.energy_definition===original.energy_definition);
 const selected=accepted?compatible.find(m=>m.model_id===result.bridge_model?.model_id&&m.version===result.bridge_model?.version&&m.dataset.id===result.reference_dataset?.id):null;
 return {...result,universal_bridge_version:UNIVERSAL_BRIDGE_VERSION,calibration_status:accepted?'CALIBRATED':'NOT_CALIBRATED',
  applicability_domain:{status:accepted?'IN_DOMAIN':compatible.length?'OUT_OF_DOMAIN':'NOT_ESTABLISHED',reason:accepted?'Validated identity and descriptor ranges passed.':compatible.length?'No unique validated model passed the identity/descriptor/conformer applicability gates.':'No compatible independently validated universal model; applicability is not established.'},
  universal_structure:s,universal_descriptors:b,bridge_descriptors:b,
  feature_vector:validIdentity?bridgeFeatures(f,view):{},
  bridge_reason:validIdentity?result.bridge_reason:'Universal structure/descriptor analysis unavailable or molecular identity mismatch.',
  validation_sample_counts:selected?{training:selected.dataset.records.filter(r=>r.split==='TRAIN').length,independent_validation:selected.dataset.records.filter(r=>r.split==='VALIDATION').length}:null};
}
export function applyTiNUniversalBridge(original:any,f:FluorineDescriptors|null,s:UniversalStructure|null,b:BridgeDescriptors|null,models:readonly UniversalBridgeModel[]=TIN_UNIVERSAL_MODELS){
 return applyUniversalBridge(original,f,s,b,original.surface_id?.startsWith('TIN_')?models:[]);
}
export function applyAl2O3UniversalBridge(original:any,f:FluorineDescriptors|null,s:UniversalStructure|null,b:BridgeDescriptors|null,models:readonly UniversalBridgeModel[]=AL2O3_UNIVERSAL_MODELS){
 return applyUniversalBridge(original,f,s,b,original.surface_id?.startsWith('AL2O3_')?models:[]);
}
export function applyUniversalIntegration(original:any,f:FluorineDescriptors|null,base:BridgeDescriptors|null,s:UniversalStructure|null,b:BridgeDescriptors|null){
 const p1f=applyBridgeIntegration(original,f,base);
 const g=original.surface_id?.startsWith('TIN_')?applyTiNUniversalBridge(original,f,s,b):applyAl2O3UniversalBridge(original,f,s,b);
 return {...p1f,...g,original_model_calibration_status:original.calibration_status,p1f_bridge:p1f,
  universal_applicability_domain:g.applicability_domain,applicability_domain:original.applicability_domain,
  correction_reason:g.bridge_reason};
}
