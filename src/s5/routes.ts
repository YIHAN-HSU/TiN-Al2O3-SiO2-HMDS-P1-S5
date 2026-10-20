import type {Express} from 'express';import {history,retrieve} from './service';import {loadReferences,loadModels,eligible} from './thermodynamics';
import {projectResults,resultsCsv,resultsMode} from './resultsView';
export function registerS5Routes(app:Express){
 // Read-only legacy export: retained for saved records; never runs prediction.
 app.get('/api/s5/analyses/:id/poor-co.csv',async(req,res)=>{try{const {poorCoCsv}=await import('../poorCo/service');res.type('text/csv; charset=utf-8').attachment('S5-poor-co-'+req.params.id+'.csv').send(poorCoCsv(await retrieve(req.params.id)));}catch(e:any){res.status(e.message==='ANALYSIS_NOT_FOUND'?404:400).json({error:e.message});}});
 app.get('/api/s5/analyses/:id/results.csv',async(req,res)=>{try{const result=await retrieve(req.params.id),mode=resultsMode(req.query.mode??'AUTOMATIC');res.type('text/csv; charset=utf-8').attachment('S5-results-'+result.analysis_id+'-'+mode+'.csv').send(resultsCsv(projectResults(result,mode)));}catch(e:any){res.status(e.message==='ANALYSIS_NOT_FOUND'?404:400).json({error:e.message});}});
 app.get('/api/s5/history',(_req,res)=>res.json(history()));
 app.get('/api/s5/analyses/:id',async(req,res)=>{try{res.json(await retrieve(req.params.id));}catch(e:any){res.status(e.message==='ANALYSIS_NOT_FOUND'?404:400).json({error:e.message});}});
 app.get('/api/s5/evidence',(_req,res)=>{const records=loadReferences();res.json({version:'P1-S5-1.0',records,eligible_training_records:records.filter(eligible).length,deployed_models:loadModels().length,status:'MODEL_NOT_VALIDATED'});});
}
