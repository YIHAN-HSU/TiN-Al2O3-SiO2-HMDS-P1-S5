import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {contextGaps,key,unavailable,type ThermoContext,type GResult} from './thermodynamics';
// Review-controlled local records only. Merely supplying a numerical result is insufficient.
export function calculatedG(identity:string,surface:string,c:ThermoContext):GResult{
 const registry=path.resolve('reference/s5/numerical/calculated.json');if(!fs.existsSync(registry))return unavailable('NO_REVIEWED_ACTUAL_DFT_G_RECORD');
 const matches=JSON.parse(fs.readFileSync(registry,'utf8')).filter((r:any)=>{
  try{
   if(r.identity!==identity||r.surface!==surface||key(r.context)!==key(c)||contextGaps(c,surface==='HMDS_SiO2').length||r.status!=='CALCULATED_DELTA_G'||r.review?.approved!==true||!r.review?.reviewer||!r.convergence?.geometry||!r.convergence?.electronic||!r.convergence?.cutoff||!r.convergence?.vacuum||!r.convergence?.kpoints||!r.convergence?.slab_thickness||!r.convergence?.orientations)return false;
   if(![r.eads_ev,r.delta_zpe_ev,r.delta_gthermal_ev,r.delta_g_ev,r.uncertainty_ev].every(Number.isFinite)||r.uncertainty_ev<0||Math.abs(r.delta_g_ev-r.eads_ev-r.delta_zpe_ev-r.delta_gthermal_ev)>1e-8||!r.thermodynamic_method||!r.reference_state||!r.proofs?.length)return false;
   for(const p of r.proofs){const file=path.resolve(p.file);if(!file.startsWith(path.resolve('dft/s5-numerical')+path.sep)||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==p.sha256)return false;}
   return ['surface','molecule','complex'].every(kind=>r.proofs.some((p:any)=>p.kind===kind&&p.file.endsWith('.pwo')&&/convergence has been achieved/.test(fs.readFileSync(p.file,'utf8'))&&/JOB DONE\./.test(fs.readFileSync(p.file,'utf8'))));
  }catch{return false;}
 });
 if(matches.length!==1)return unavailable(matches.length?'AMBIGUOUS_ACTUAL_G_RECORD':'NO_REVIEWED_COMPATIBLE_ACTUAL_DFT_G_RECORD');const r=matches[0];return {...unavailable('Actual compatible DFT thermochemistry; all terms and convergence reviewed.'),value_ev:r.delta_g_ev,uncertainty_ev:r.uncertainty_ev,prediction_method:'CALCULATED_DELTA_G',validation_status:'REVIEWED_CALCULATION',model_id:r.id,model_version:r.version,reference_source:r,applicability_domain:'EXACT_MOLECULE_AND_SURFACE_CONTEXT'};
}
