import React from 'react';
export function HybridDetails({result}:{result:any}){
 const h=result.hybrid;if(!h)return null;const d=h.descriptors,shape=d.shape;
 return <section data-testid="s5-hybrid-details" className="border rounded p-3 space-y-2 min-w-0 text-sm">
 <h3 className="font-semibold">Hybrid ΔGads · molecular features and evidence</h3>
 <p className="break-words">{Object.entries(d.functional_groups).filter(([,n])=>Number(n)>0).map(([k,n])=>`${k}: ${n}`).join(' · ')}</p>
 <p>MW: {d.physical.MW} g/mol · TPSA: {d.physical.TPSA} Å² · Volume: {shape.molecular_volume_angstrom3??'NOT_CALCULATED'} Å³ · SASA: {shape.solvent_accessible_area_angstrom2??'NOT_CALCULATED'} Å²</p>
 <p className="text-xs">Volume/SASA/steric features use the existing RDKit conformer; these are not adsorption contact energies. Quantum polarizability: NOT_CALCULATED. B → Gibbs data are not yet available; A/B energies are never averaged.</p>
 {result.four_substrate_results.filter((r:any)=>r.reason_codes?.length).map((r:any)=><p key={r.substrate_id} data-testid={'hybrid-reason-'+r.substrate_id} className="break-words text-amber-800">{r.substrate_id}: {r.reason_codes.join(' · ')}{r.high_uncertainty&&' · HIGH_UNCERTAINTY / OUT_OF_DOMAIN — no defensible numerical uncertainty or ΔG is supplied.'}</p>)}
 <details><summary>Hybrid prediction trace / descriptors / transfer reference</summary><pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(h,null,2)}</pre></details>
 </section>;
}
