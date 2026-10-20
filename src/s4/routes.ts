import type {Express} from 'express';import {SUBSTRATES,S4_VERSION} from './registry';import {s4db} from './store';import {readJob,startS4Queue} from './jobs';import {retrieveAnalysis} from './service';
export function registerS4Routes(app:Express){s4db();startS4Queue();
 app.get('/api/substrates',(_req,res)=>res.json({version:S4_VERSION,substrates:SUBSTRATES}));
 app.get('/api/s4/history',(_req,res)=>res.json(s4db().prepare('SELECT analysis_id,smiles,identity_key,created_at FROM s4_analyses ORDER BY created_at DESC LIMIT 200').all()));
 app.get('/api/s4/jobs',(_req,res)=>res.json(s4db().prepare('SELECT job_id,substrate_id,surface_model_id,status,created_at FROM s4_dft_jobs ORDER BY created_at DESC LIMIT 200').all()));
 app.get('/api/s4/jobs/:id',async(req,res)=>{try{res.json(await readJob(req.params.id));}catch(e:any){res.status(e.message==='JOB_NOT_FOUND'?404:400).json({error:e.message});}});
 app.get('/api/s4/analyses/:id',async(req,res)=>{try{res.json(await retrieveAnalysis(req.params.id));}catch(e:any){res.status(e.message==='ANALYSIS_NOT_FOUND'?404:400).json({error:e.message});}});
}
