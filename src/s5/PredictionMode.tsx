import React from 'react';
import type {PredictionMode as Mode} from './hypothetical';
export function PredictionModeControl({mode,onMode,assumptionSet,onSet,overrides,onOverrides}:{mode:Mode;onMode:(v:Mode)=>void;assumptionSet:string;onSet:(v:string)=>void;overrides:string;onOverrides:(v:string)=>void}){
 const [config,setConfig]=React.useState<any>(null),[error,setError]=React.useState('');
 React.useEffect(()=>{fetch('/api/s5/hypothetical-config').then(async r=>{if(!r.ok)throw new Error('Assumption configuration unavailable');return r.json();}).then(setConfig).catch(e=>setError(e.message));},[]);
 return <fieldset className="border rounded-lg p-3 text-sm min-w-0 space-y-2" data-testid="prediction-mode-control"><legend className="font-semibold">Prediction Mode</legend>
 <select aria-label="Prediction Mode" className="border rounded p-2 w-full" value={mode} onChange={e=>onMode(e.target.value as Mode)}><option value="SCIENTIFIC_PREDICTION">Scientific Prediction · Eads / ΔGads</option><option value="HYPOTHETICAL_SIMULATION" disabled={!config}>Hypothetical Simulation · Scenario Unit (SU)</option></select>
 <p>Mode switches the displayed results. Analyze calculates the current input and assumptions; missing scenario values require Analyze. No automatic fallback when scientific data are missing.</p>
 {error&&<p role="alert">{error}</p>}
 {mode==='HYPOTHETICAL_SIMULATION'&&config&&<><p className="text-amber-800 font-semibold">HYPOTHETICAL_SIMULATION · NOT_VALIDATED · NOT_PHYSICAL_DELTA_G</p><p>Assumed structural scenarios only. SU scores are not eV, Gibbs energies, experimental affinity or confidence intervals.</p>
 <label className="block">Assumption Set<select aria-label="Assumption Set" className="block w-full border rounded p-2" value={assumptionSet} onChange={e=>onSet(e.target.value)}>{Object.keys(config.presets).map(k=><option key={k} value={k}>{k}</option>)}</select></label>
 <details><summary>Adjust assumed parameters (JSON overrides)</summary><p className="text-xs">Use parameter IDs below and numbers within their declared ranges. TMS coverage and OH activity are assumed fractions, not measured densities.</p><textarea aria-label="Assumed parameter overrides JSON" className="w-full border rounded p-2 font-mono text-xs min-h-24" value={overrides} onChange={e=>onOverrides(e.target.value)} placeholder={'{"HMDS_SiO2.tms_coverage": 0.6}'}/><div className="max-h-64 overflow-auto min-w-0"><table className="text-xs w-full text-left"><thead><tr><th>Parameter</th><th>Default / range</th><th>Source</th></tr></thead><tbody>{Object.entries(config.parameters as Record<string,any>).map(([k,p])=><tr key={k}><td className="p-1 border-b break-all">{k}</td><td className="p-1 border-b">{p.value} / [{p.minimum}, {p.maximum}]</td><td className="p-1 border-b">{p.provenance}</td></tr>)}</tbody></table></div></details></>}
 </fieldset>;
}

