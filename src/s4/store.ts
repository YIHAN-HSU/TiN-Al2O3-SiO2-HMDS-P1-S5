import {getDatabase} from '../db/database';import {assertIsolation} from './isolation';
let migrated=false;
export function s4db(){assertIsolation();const db=getDatabase();if(!migrated){db.exec('PRAGMA busy_timeout=5000');db.exec(`
CREATE TABLE IF NOT EXISTS s4_analyses(analysis_id TEXT PRIMARY KEY,smiles TEXT NOT NULL,identity_key TEXT NOT NULL,created_at TEXT NOT NULL,response_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS s4_results(analysis_id TEXT NOT NULL,substrate_id TEXT NOT NULL,surface_state TEXT NOT NULL,surface_model_id TEXT NOT NULL,surface_model_version TEXT NOT NULL,prediction_method TEXT NOT NULL,raw_eads_ev REAL,bridge_correction_ev REAL,corrected_eads_ev REAL,calibration_status TEXT NOT NULL,dft_job_id TEXT,calculation_status TEXT NOT NULL,reference_source TEXT,validation_metrics TEXT,created_at TEXT NOT NULL,result_json TEXT NOT NULL,PRIMARY KEY(analysis_id,substrate_id),FOREIGN KEY(analysis_id) REFERENCES s4_analyses(analysis_id));
CREATE TABLE IF NOT EXISTS s4_dft_jobs(job_id TEXT PRIMARY KEY,cache_key TEXT NOT NULL UNIQUE,substrate_id TEXT NOT NULL,surface_model_id TEXT NOT NULL,identity_key TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,request_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS s4_schema(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
INSERT OR IGNORE INTO s4_schema VALUES(1,datetime('now'));`);migrated=true;}return db;}
