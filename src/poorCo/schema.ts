export const POOR_CO_VERSION='P1-S5-POOR-CO-1.0.0';
export type Assessment='DEWETTING'|'UNIFORMITY';
export type PoorCoMode='STRUCTURE_ONLY'|'FORMULATION_PROCESS';
export type Datum={value:string|number|null;provenance:'MEASURED'|'ASSUMED'|'UNKNOWN';source?:string;context_id?:string;uncertainty?:number};
export type PoorCoRequest={enabled:boolean;mode?:PoorCoMode;assessments?:Assessment[];inputs?:Record<string,Datum>};
export type Field={key:string;label:string;unit:string;numeric?:boolean;min?:number;max?:number;section:string};
const f=(key:string,label:string,unit:string,section:string,numeric=false,min?:number,max?:number):Field=>({key,label,unit,section,numeric,min,max});
export const COMMON_FIELDS:Field[]=[
 f('resin_type','Resin Type','text','Formulation'),f('monomer_wt','Monomer / Additive wt%','wt%','Formulation',true,0,100),f('solvent_type','Solvent Type','text','Formulation'),f('solvent_ratio','Solvent Ratio / basis','text','Formulation'),f('solid_content','Solid Content','wt%','Formulation',true,0,100),f('viscosity','Dynamic Viscosity','mPa·s','Formulation',true,0),f('gamma_lv','Liquid–Vapor Surface Tension γLV','mN/m','Formulation',true,0),
 f('spin_speed','Spin Speed','rpm','Process',true,0),f('spin_time','Spin Time','s','Process',true,0),f('acceleration','Spin Acceleration','rpm/s','Process',true,0),f('target_thickness','Target Film Thickness','nm','Process',true,0),f('bake_temperature','Bake Temperature','°C','Process',true,-273.15),f('bake_time','Bake Time','s','Process',true,0),f('evaporation_behavior','Evaporation / volatility behavior','text','Process'),f('resin_compatibility','Resin / solvent compatibility evidence','text','Process')];
export function surfaceFields(id:string):Field[]{const section=id+' inputs';return [f(id+'.pretreatment','Substrate Pretreatment','text',section),f(id+'.contamination','Surface Contamination','text',section),f(id+'.contact_angle','Contact Angle (actual formulation)','degree',section,true,0,180),f(id+'.gamma_sv','Solid–Vapor Interfacial Energy γSV','mN/m',section,true,0),f(id+'.gamma_sl','Solid–Liquid Interfacial Energy γSL','mN/m',section,true,0),f(id+'.observation','Poor Co Observation','text',section),f(id+'.defect_count','Defect Count','count',section,true,0),f(id+'.thickness_max_min','Thickness Max–Min','nm',section,true,0),f(id+'.cr','C/R (record definition in source)','dimensionless',section,true,0),f(id+'.historical_pass_fail','Historical Pass / Fail','text',section),...(id==='HMDS_SiO2'?[f(id+'.tms_coverage','Measured TMS Coverage','groups/nm²',section,true,0),f(id+'.residual_oh','Measured Residual OH','OH/nm²',section,true,0)]:[])];}
export function validatePoorCo(value:any):PoorCoRequest|null{
 if(value===undefined)return null;
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.enabled!=='boolean')throw new Error('POOR_CO_ENABLED_MUST_BE_BOOLEAN');
 if(!value.enabled)return null;
 if(!['STRUCTURE_ONLY','FORMULATION_PROCESS'].includes(value.mode))throw new Error('POOR_CO_INVALID_MODE');
 if(!Array.isArray(value.assessments)||!value.assessments.length||new Set(value.assessments).size!==value.assessments.length||value.assessments.some((x:string)=>!['DEWETTING','UNIFORMITY'].includes(x)))throw new Error('POOR_CO_SELECT_AT_LEAST_ONE_UNIQUE_ASSESSMENT');
 if(value.mode==='FORMULATION_PROCESS'&&value.inputs!==undefined&&(!value.inputs||Array.isArray(value.inputs)||typeof value.inputs!=='object'))throw new Error('POOR_CO_INVALID_INPUTS');
 const fields=[...COMMON_FIELDS,...['TiN','Al2O3','SiO2','HMDS_SiO2'].flatMap(surfaceFields)];
 for(const [key,v] of Object.entries(value.mode==='FORMULATION_PROCESS'?value.inputs||{}:{}) as [string,any][]){
  const spec=fields.find(f=>f.key===key);if(!spec||!v||typeof v!=='object'||!['UNKNOWN','MEASURED','ASSUMED'].includes(v.provenance))throw new Error('POOR_CO_INVALID_DATUM:'+key);
  if(v.provenance==='UNKNOWN'){if(v.value!==null&&v.value!==undefined&&v.value!=='')throw new Error('POOR_CO_UNKNOWN_VALUE_MUST_BE_EMPTY:'+key);continue;}
  if(v.value===null||v.value===undefined||v.value===''||typeof v.source!=='string'||!v.source.trim())throw new Error('POOR_CO_VALUE_AND_SOURCE_REQUIRED:'+key);
  if(spec.numeric){if(typeof v.value!=='number'||!Number.isFinite(v.value)||(spec.min!==undefined&&v.value<spec.min)||(spec.max!==undefined&&v.value>spec.max))throw new Error('POOR_CO_INVALID_RANGE:'+key);if(key.endsWith('.defect_count')&&!Number.isInteger(v.value))throw new Error('POOR_CO_COUNT_MUST_BE_INTEGER:'+key);}
  else if(typeof v.value!=='string'||v.value.length>3000)throw new Error('POOR_CO_TEXT_REQUIRED:'+key);
  if(v.context_id!==undefined&&typeof v.context_id!=='string')throw new Error('POOR_CO_CONTEXT_MUST_BE_TEXT:'+key);
  if(v.uncertainty!==undefined&&(typeof v.uncertainty!=='number'||!Number.isFinite(v.uncertainty)||v.uncertainty<0))throw new Error('POOR_CO_INVALID_UNCERTAINTY:'+key);
 }
 return {enabled:true,mode:value.mode,assessments:[...value.assessments],inputs:value.mode==='FORMULATION_PROCESS'?value.inputs||{}:{}};
}
