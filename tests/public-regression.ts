import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {publicAnalyze,PublicError} from '../src/public/service';
import {integratedAnalyze} from '../src/integration/service';
import {withMemoryDatabase,getDatabase} from '../src/db/database';
import {resultsCsv,projectResults} from '../src/s5/resultsView';
process.env.S5_PUBLIC_MODE='1';process.env.PYTHONUTF8='1';
if(process.platform==='win32'&&!process.env.PYTHON_EXECUTABLE)process.env.PYTHON_EXECUTABLE=path.resolve('.venv/Scripts/python.exe');
let passed=0;const checks:any[]=[];
function check(name:string,test:()=>any){test();passed++;checks.push({name,status:'PASS'});}
const surfaces=['TiN','Al2O3','SiO2','HMDS_SiO2'];
const baseline:[string,number,number][]=[['CCO',-.8049139562000001,-.60],['COCCO',-1.0280412393999998,-.80],['CC(=O)O',-1.030309693,-1.06],['CCOC(=O)C',-.6726228366,-.91],['c1ccccc1',-.5446305766,-.45],['C=COCCOCCOC=C',-1.1806647579999998,-1.03]];
const diskFiles=['data/materials.db','advanced/data/materials.db'].filter(fs.existsSync).map(p=>[p,fs.statSync(p).mtimeMs]);
let ethanol:any;
for(const [smiles,tin,al] of baseline){const r=await publicAnalyze({input_type:'SMILES',raw_text:smiles,substrates:surfaces,poor_co:{enabled:true}}).catch(async error=>{const diagnostic=await withMemoryDatabase(()=>integratedAnalyze({input_type:'SMILES',raw_text:smiles,mode:'DUAL'}));console.error('FIXED_REGRESSION_INPUT_DIAGNOSTIC',JSON.stringify({errors:diagnostic.errors,geometry_status:diagnostic.geometry?.status}));throw error;});if(smiles==='CCO')ethanol=r;
 check(smiles+' TiN exact raw',()=>assert.equal(r.prediction.raw_predicted_eads_ev,tin));
 check(smiles+' Al2O3 exact raw',()=>assert.equal(r.al2o3.raw_predicted_eads_ev,al));
 check(smiles+' automatic SU and units',()=>{assert.equal(r.integrated_results.rows.length,4);for(const row of r.integrated_results.rows){assert.ok(Number.isFinite(row.final.value));assert.equal(row.final.unit,['TiN','Al2O3'].includes(row.substrate_id)?'eV':'SU');}});
 check(smiles+' no shared records / Poor Co',()=>{assert.equal(r.history,undefined);assert.equal(r.poor_co,undefined);assert.equal(r.poor_co_feature_status,'DISABLED');});
 check(smiles+' real structure',()=>{assert.ok(r.geometry.is_real_3d);assert.ok(r.geometry.svg_depiction.includes('<svg'));assert.ok(r.geometry.atoms.length>0);});
}
for(const [kind,value] of [['InChI',ethanol.geometry.inchi],['MDL',ethanol.geometry.mol_block]]){assert.ok(value);const r=await publicAnalyze({input_type:kind,raw_text:value,substrates:surfaces});check(kind+' original values and SU',()=>{assert.equal(r.prediction.raw_predicted_eads_ev,baseline[0][1]);assert.equal(r.al2o3.raw_predicted_eads_ev,baseline[0][2]);assert.ok(r.integrated_results.rows.every((x:any)=>Number.isFinite(x.final.value)));});}
for(const id of surfaces){const r=await publicAnalyze({input_type:'SMILES',raw_text:'CCO',substrates:[id]});check('single '+id,()=>{assert.deepEqual(r.integrated_results.rows.map((x:any)=>x.substrate_id),[id]);assert.ok(Number.isFinite(r.integrated_results.rows[0].final.value));});}
const csv=resultsCsv(projectResults(ethanol));check('CSV eV SU and validation',()=>{for(const word of ['SU','eV','NOT_PHYSICAL_DELTA_G','EXISTING_V1.2_SCREENING_MODEL'])assert.ok(csv.includes(word));});
check('no memory database outside request',()=>assert.throws(()=>getDatabase(),/PUBLIC_DATABASE_SCOPE_REQUIRED/));
await Promise.all(['A','B'].map(id=>withMemoryDatabase(async()=>{const db=getDatabase();db.exec('CREATE TABLE guest(value TEXT)');db.prepare('INSERT INTO guest VALUES(?)').run(id);await new Promise(r=>setTimeout(r,10));check('concurrent private scope '+id,()=>assert.deepEqual(db.prepare('SELECT value FROM guest').all().map((r:any)=>r.value),[id]));})));
for(const payload of [{input_type:'SMILES',raw_text:'bad smiles',substrates:surfaces},{input_type:'SMILES',raw_text:'CCO',substrates:[]},{input_type:'IMAGE',raw_text:'x',substrates:surfaces}]){await assert.rejects(()=>publicAnalyze(payload),PublicError);passed++;}
for(const [file,mtime] of diskFiles)check('unchanged local SQLite '+file,()=>assert.equal(fs.statSync(file as string).mtimeMs,mtime));
const report={passed,failed:0,checks};console.log(JSON.stringify(report,null,2));
