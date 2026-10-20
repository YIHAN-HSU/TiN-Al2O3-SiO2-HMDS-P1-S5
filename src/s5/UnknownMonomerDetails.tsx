import React from 'react';
import type {UnknownMonomerSurface} from './hybridTypes';
const num=(x:number|null)=>x===null?'N/A':Number(x).toPrecision(6);
export function UnknownMonomerDetails({result}:{result:any}){
 const u=result.hybrid?.unknown_monomer;if(!u)return null;
 const selected=new Set(result.four_substrate_results.map((r:any)=>r.substrate_id));
 return <section data-testid="unknown-monomer-results" className="min-w-0 space-y-3 border rounded p-3 text-sm">
 <h3 className="font-semibold">Unknown Monomer · Exploratory ΔGads</h3>
 <p className="text-xs">Whole-molecule models evaluate new identities. Similarity supports applicability; reference values are never copied as your molecule’s adsorption free energy.</p>
 {Object.entries(u.surfaces as Record<string,UnknownMonomerSurface>).filter(([surface])=>selected.has(surface)).map(([surface,p])=><article data-testid={'unknown-'+surface} key={surface} className="border rounded p-3 min-w-0 space-y-2">
 <h4 className="font-semibold">{surface==='SiO2'?'SiO₂':'HMDS / TMS–SiO₂'} · {p.prediction_level}</h4>
 <p>Predicted ΔGads: <strong>{num(p.predicted_delta_g_ev)} eV</strong> · Uncertainty: {num(p.uncertainty_ev)} eV</p>
 <p className="text-xs break-words">{p.uncertainty_definition}</p>
 <p className="text-xs break-words">Surface conditions: {p.surface_conditions.morphology} · {p.surface_conditions.temperature_k??'UNSPECIFIED'} K · {p.surface_conditions.standard_state??'Standard state unspecified'} · TMS coverage: {p.surface_conditions.tms_coverage_nm2??'UNSPECIFIED'} nm⁻² · Residual OH: NOT_QUANTIFIED</p>
 {p.missing_quantitative_basis.length>0&&<div className="text-amber-800 break-words"><strong>Missing quantitative basis / extrapolation risk</strong><ul className="list-disc pl-5">{p.missing_quantitative_basis.map(x=><li key={x}>{x}</li>)}</ul></div>}
 <p>Similar reference molecules · Morgan radius 2 / 2048-bit Tanimoto</p>
 <div className="min-w-0 max-w-full overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{['Reference','Similarity','Compatibility','Reference ΔG (eV) / T','Data provenance'].map(x=><th className="p-1 border-b" key={x}>{x}</th>)}</tr></thead><tbody>{p.similar_reference_molecules.map(r=><tr key={r.id}><td className="p-1 border-b break-words">{r.molecule}<br/><span className="break-all">{r.smiles}</span></td><td className="p-1 border-b">{r.tanimoto.toFixed(3)}</td><td className="p-1 border-b">{r.compatible?'COMPATIBLE':'CONTEXT MISMATCH'}<br/>{r.compatibility_reason}</td><td className="p-1 border-b">{num(r.reference_value_ev)} / {r.temperature_k} K<br/>Reference only</td><td className="p-1 border-b break-words"><a className="underline" href={'https://doi.org/'+r.doi} target="_blank" rel="noreferrer">{r.doi}</a><br/>{r.verification_status}</td></tr>)}</tbody></table></div>
 <p className="text-xs">Relative tendency for this query: {p.relative_evidence.query_relative_affinity}. Reference ordering is evidence about those references only; it does not establish a ranking for an unsupported multifunctional molecule.</p>
 <p className="text-xs break-all">Model: {p.model_id} / {p.version} · Data: {p.training_data_provenance.compatible_unique_identity_count} compatible identities · Independently validated: NO</p>
 <details><summary>Model applicability, reference trends and provenance</summary><pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify({domain:p.applicability_domain,trend:p.relative_evidence,provenance:p.training_data_provenance},null,2)}</pre></details>
 </article>)}
 </section>;
}
