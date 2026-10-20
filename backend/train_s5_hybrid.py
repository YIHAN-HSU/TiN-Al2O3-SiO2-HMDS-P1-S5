"""Reproducible small-data model selection; all labels are compatible IGC derivatives.
Nested identity-LOO is internal evidence, NOT an independent experimental validation.
"""
from pathlib import Path
import json,hashlib,sys
import numpy as np
from rdkit import DataStructs
from s5_numerical import features,FEATURES
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'reference/s5/hybrid/S5_HYBRID_DATASET.json';OUT=D.parent/'trained-direct-models.json'
CANDIDATES=[('MEAN',0)]+[(family,alpha) for family in ['RIDGE','DESCRIPTOR_MORGAN_KRR'] for alpha in [.01,.1,1,10]]
def prediction(train,query,candidate):
    family,alpha=candidate;X=np.array([r['x'] for r in train]);y=np.array([r['y'] for r in train]);mean=X.mean(0);scale=X.std(0);scale[scale==0]=1;Z=(X-mean)/scale;q=(query['x']-mean)/scale;center=y.mean()
    if family=='MEAN':return float(center)
    if family=='RIDGE':return float(center+q@np.linalg.solve(Z.T@Z+alpha*np.eye(len(FEATURES)),Z.T@(y-center)))
    def kernel(x,z,fp,fq):return np.exp(-np.mean((x-z)**2))*DataStructs.TanimotoSimilarity(fp,fq)
    K=np.array([[kernel(Z[i],Z[j],a['fp'],b['fp']) for j,b in enumerate(train)] for i,a in enumerate(train)]);k=np.array([kernel(q,Z[i],query['fp'],r['fp']) for i,r in enumerate(train)]);return float(center+k@np.linalg.solve(K+alpha*np.eye(len(train)),y-center))
def loo(train,candidate):return [prediction([r for j,r in enumerate(train) if j!=i],q,candidate)-q['y'] for i,q in enumerate(train)]
def metrics(errors):return dict(mae_ev=float(np.mean(np.abs(errors))),rmse_ev=float(np.sqrt(np.mean(np.square(errors)))))
def select(train):
    trials=[dict(family=c[0],alpha=c[1],**metrics(loo(train,c))) for c in CANDIDATES];best=min(trials,key=lambda r:r['rmse_ev']);return (best['family'],best['alpha']),trials
def data_rows(T):
    records=json.loads(D.read_text())['records'];rows=[]
    for r in records:
        if r['training_role']=='TMS_DIRECT_DERIVED_LABEL' and r['temperature_k']==T:
            _,x,fp=features(r['canonical_smiles']);rows.append(dict(id=r['id'],identity=r['identity'],smiles=r['canonical_smiles'],x=x,fp=fp,y=r['value'],source_bound_ev=float(r['original']['uncertainty_ev'])))
    assert len(rows)==9 and len({r['identity'] for r in rows})==9;return rows
def train():
    models=[]
    for T in [403,423]:
        rows=data_rows(T);candidate,trials=select(rows);outer=[]
        for i,q in enumerate(rows):
            subset=[r for j,r in enumerate(rows) if j!=i];chosen,_=select(subset);p=prediction(subset,q,chosen);X=np.array([r['x'] for r in subset]);supported=bool(np.all(q['x']>=X.min(0)-1e-9) and np.all(q['x']<=X.max(0)+1e-9));outer.append(dict(identity=q['identity'],predicted_ev=p,target_ev=q['y'],error_ev=p-q['y'],inner_selected_family=chosen[0],inner_alpha=chosen[1],inside_fold_descriptor_box=supported))
        nested=metrics([r['error_ev'] for r in outer]);model=dict(id='HMDS_Hybrid_DeltaG_Predictor',version='P1-S5-HYBRID-1.0.0',surface_model='R2007_SILOCHROM_TMS_2.8NM2',temperature_k=T,standard_state=json.loads(D.read_text())['records'][0]['standard_state'],energy_type='TOTAL_STANDARD_DELTA_G_DERIVED',fusion_status='A_ONLY; NO_COMPATIBLE_B_GIBBS_LABELS',dataset_sha256=hashlib.sha256(D.read_bytes()).hexdigest(),features=FEATURES,selected_family=candidate[0],regularization_alpha=candidate[1],candidate_loo=trials,nested_identity_loo={**nested,'n':9,'outer_predictions':outer,'fold_descriptor_box_supported_n':sum(r['inside_fold_descriptor_box'] for r in outer)},independent_external_test_n=0,validation_status='NOT_VALIDATED',training_unique_molecules=9,rows=[{k:(v.tolist() if isinstance(v,np.ndarray) else v) for k,v in r.items() if k!='fp'} for r in rows],source_bound_ev=max(r['source_bound_ev'] for r in rows),limitations=['Correlated same-study global-fit-derived labels, not nine direct Gibbs measurements','Hyperparameter selection internal only; no independent source or wafer validation','LOO includes chemistry outside individual-fold boxes; coverage is reported, not hidden','3D shape/electronic descriptors are reported but not trained as covariates without a standardized reference conformer protocol.'])
        baseline=next(r['rmse_ev'] for r in trials if r['family']=='MEAN');model['baseline_identity_loo_rmse_ev']=baseline;model['exploratory_structure_inference_enabled']=candidate[0]!='MEAN' and nested['rmse_ev']<baseline;model['selection_gate']='PROVISIONAL_NESTED_LOO_BETTER_THAN_MEAN; NOT independent validation' if model['exploratory_structure_inference_enabled'] else 'MODEL_SELECTION_NOT_BETTER_THAN_BASELINE; unknown-molecule regression blocked';models.append(model)
    OUT.write_text(json.dumps(models,indent=2));print(json.dumps([dict(T=m['temperature_k'],family=m['selected_family'],alpha=m['regularization_alpha'],nested=m['nested_identity_loo']['rmse_ev'],baseline=next(r['rmse_ev'] for r in m['candidate_loo'] if r['family']=='MEAN')) for m in models]))
def infer_model(smi,T):
    model=next(m for m in json.loads(OUT.read_text()) if m['temperature_k']==T)
    if model['dataset_sha256']!=hashlib.sha256(D.read_bytes()).hexdigest():raise ValueError('HYBRID_TRAINING_DATA_CHANGED_RETRAIN_REQUIRED')
    if not model['exploratory_structure_inference_enabled']:return dict(value_ev=None,uncertainty_ev=None,calculation_method='MODEL_SELECTION_NOT_BETTER_THAN_BASELINE',reason='Nested identity-LOO did not outperform a mean baseline. No defensible structure-dependent inference is enabled at this temperature.',validation_metrics={**{k:v for k,v in model['nested_identity_loo'].items() if k!='outer_predictions'},'baseline_rmse_ev':model['baseline_identity_loo_rmse_ev'],'independent_external_test_n':0})
    _,x,fp=features(smi);query=dict(x=x,fp=fp);rows=data_rows(T);value=prediction(rows,query,(model['selected_family'],model['regularization_alpha']));uncertainty=float(np.sqrt(model['nested_identity_loo']['rmse_ev']**2+model['source_bound_ev']**2))
    return dict(value_ev=value,uncertainty_ev=uncertainty,calculation_method=model['selected_family']+'_SELECTED_BY_INTERNAL_IDENTITY_CV',validation_metrics={**{k:v for k,v in model['nested_identity_loo'].items() if k!='outer_predictions'},'independent_external_test_n':0},selected_family=model['selected_family'],regularization_alpha=model['regularization_alpha'],artifact_sha256=hashlib.sha256(OUT.read_bytes()).hexdigest(),uncertainty_definition='Nested identity-LOO residual scale plus source sensitivity in quadrature; heuristic, not calibrated interval; shared manuscript/derivation bias not quantified.')
if __name__=='__main__':train()
