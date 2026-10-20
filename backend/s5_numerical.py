"""Literature-conditioned exploratory models, never silently applied to a wafer.
Source: Roshchina et al. 2007, original Russian publication pp230-234, Tables2/5.
Model populations and actual observations remain separate from derived sample grids.
"""
from pathlib import Path
import json,sys,math,hashlib,csv
import numpy as np
from rdkit import Chem,DataStructs
from rdkit.Chem import Descriptors,Lipinski,rdMolDescriptors,rdFingerprintGenerator
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'reference/s5/numerical/igc.json';KB=8.617333262145e-5
FEATURES=['MW','LogP','TPSA','HBD','HBA','RB','aromatic_rings','ether','ester','alcohol','phenol','acid','carbonyl','amine','F','CF2','CF3']
SMARTS=['[OD2]([#6])[#6]','[CX3](=O)[OX2][#6]','[CX4][OX2H]','[c][OX2H]','[CX3](=O)[OX2H]','[CX3]=O','[NX3;!$(N[CX3]=O)]','F','[C;$(C(F)F);!$(C(F)(F)F)]','[C](F)(F)F']
def features(smiles):
    m=Chem.MolFromSmiles(smiles)
    if m is None:raise ValueError('INVALID_SMILES')
    x=[Descriptors.MolWt(m),Descriptors.MolLogP(m),rdMolDescriptors.CalcTPSA(m),Lipinski.NumHDonors(m),Lipinski.NumHAcceptors(m),Lipinski.NumRotatableBonds(m),rdMolDescriptors.CalcNumAromaticRings(m)]+[len(m.GetSubstructMatches(Chem.MolFromSmarts(s))) for s in SMARTS]
    fp=rdFingerprintGenerator.GetMorganGenerator(radius=2,fpSize=2048).GetFingerprint(m)
    return m,np.array(x,dtype=float),fp
def empty(reason):return dict(value_ev=None,uncertainty_ev=None,prediction_method='NOT_AVAILABLE',validation_status='NOT_VALIDATED',reason=reason,applicability_domain='OUT_OF_DOMAIN',dataset_size=0)
def derive_g(a,b,index,T):return -KB*T*(a+b*index/100)
def build_dataset():
    # Table2 reports -a; store signed a. Parameter errors and observation errors are NOT CIs.
    params={'SiO2':{'403':[-6.82,.596,.01,.001],'423':[-6.96,.550,.01,.001]},'HMDS_SiO2':{'403':[-7.256,.463,.025,.003],'423':[-7.499,.427,.008,.007]}}
    probes=[('Benzene','c1ccccc1',689,674),('Toluene','Cc1ccccc1',798,783),('Ethylbenzene','CCc1ccccc1',899,888),('Diethyl Ether','CCOCC',817,735),('tert-Butanol','CC(C)(C)O',1028,982),('Ethyl Acetate','CCOC(=O)C',1001,920),('Acetone','CC(=O)C',987,886),('Butanone','CCC(=O)C',1031,962),('Acetonitrile','CC#N',936,892)]
    rows=[]
    for name,smi,i403,i423 in probes:
        for T,I in [(403,i403),(423,i423)]:
            a,b,da,db=params['HMDS_SiO2'][str(T)];value=derive_g(a,b,I,T)
            rows.append(dict(molecule=name,smiles=smi,inchikey=Chem.MolToInchiKey(Chem.MolFromSmiles(smi)),substrate='HMDS_SiO2',category='DERIVED_DELTA_G',raw_quantity='KOVATS_INDEX',raw_value=I,raw_unit='dimensionless',temperature_k=T,value_ev=value,uncertainty_ev=KB*T*(da+abs(I/100)*db+abs(b)*.005+math.log(1.05)),uncertainty_definition='Conservative parameter/rounding/5% retention sensitivity sum; covariance unavailable; not a calibrated interval',source_table='Table2 + Table5; original p232/233',calculation='ln K=a+b I/100; G=-kBT ln K; global fitted alkane line approximation',standard_state='mobile 1 umol/mL; stationary 1 umol/m2',phase='GAS_PHASE_REFERENCE',tms_coverage_nm2=2.8,residual_oh_nm2=None,surface='Silochrom S-120 TMS-SiI modified powder; not a wafer',doi='10.3103/S0027131407040037',source='https://www.chem.msu.ru/rus/vmgu/074/230.pdf',verification='TEXT_VALUES_VERIFIED; original table image not retrievable in local network',training_role='Correlated derived labels; NOT independent measurements; do not pool temperatures as independent molecules'))
    result=dict(version='P1-S5-NUMERICAL-0.1',review_date='2026-10-15',params=params,observations=rows,independent_molecules=9,standard_state=rows[0]['standard_state'],temperature_k=[403,423],limitations=['Original primary text reviewed; local PDF download/render failed, transcription requires independent image audit before any validated claim.','Silochrom powder is not the user wafer. OH/residual OH not quantified.','Kovats-derived G uses a global alkane-line approximation, not individually measured absolute G.','No fluorinated calibration molecules.'])
    DATA.parent.mkdir(parents=True,exist_ok=True);DATA.write_text(json.dumps(result,indent=2),encoding='utf-8')
    fields=list(rows[0]);out=ROOT/'P1_S5_VERIFIED_THERMODYNAMIC_DATASET.csv'
    # Name requested by user; verification/category columns explicitly identify derived/incomplete rows.
    with out.open('w',newline='',encoding='utf-8-sig') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    return result
def alkane(m):
    return m.GetNumAtoms()>=2 and all(a.GetAtomicNum()==6 and not a.IsInRing() for a in m.GetAtoms()) and all(b.GetBondType()==Chem.BondType.SINGLE for b in m.GetBonds()) and max(a.GetDegree() for a in m.GetAtoms())<=2 and len(Chem.GetMolFrags(m))==1
def model(smiles,surface,T,dataset):
    m,x,fp=features(smiles);a,b,da,db=dataset['params'][surface][str(T)];identity=Chem.MolToInchiKey(m)
    common=dict(model_id='SiO2_Exploratory_DeltaG_Model' if surface=='SiO2' else 'HMDS_Exploratory_Surface_Transfer_Model',model_version=dataset['version'],validation_status='NOT_VALIDATED',temperature_k=T,standard_state=dataset['standard_state'],surface_model_id='R2007_SILOCHROM_S120' if surface=='SiO2' else 'R2007_SILOCHROM_TMS_2.8NM2',tms_coverage_nm2=0 if surface=='SiO2' else 2.8,residual_oh_nm2=None,reference_source={'doi':'10.3103/S0027131407040037','tables':'2,5','data_sha256':hashlib.sha256(DATA.read_bytes()).hexdigest()},features=dict(zip(FEATURES,x.tolist())),fingerprint_on_bits=list(fp.GetOnBits()))
    if alkane(m):
        n=m.GetNumAtoms()
        if not 5<=n<=9:return {**empty('NORMAL_ALKANE_RESEARCH_DOMAIN_C5_TO_C9_ONLY'),**common}
        g=-KB*T*(a+b*n);error=KB*T*(da+n*db+math.log(1.05))
        return {**common,'value_ev':g,'uncertainty_ev':error,'uncertainty_definition':'Conservative fit-parameter and reported 5% retention sensitivity bound; NOT calibrated predictive uncertainty','prediction_method':'EXPLORATORY_ESTIMATE','calculation_method':'PUBLISHED_IGC_NORMAL_ALKANE_LN_K_FIT','applicability_domain':'PROVISIONAL_C5_C9_NORMAL_ALKANES_AT_PUBLISHED_T','dataset_size':1,'available_temperature_parameter_rows':2,'reason':'Published n-alkane fit; gas-phase Silochrom sample only. No arbitrary functional-group eV.','training_status':'Published parameter fit, not independently re-fitted from unavailable raw retention data.'}
    if surface=='SiO2':return {**empty('NO_COMPATIBLE_SIO2_TOTAL_G_LABELS_FOR_THIS_NONALKANE; specific energies/heat are not total Gibbs'),**common}
    rows=[r for r in dataset['observations'] if r['temperature_k']==T];training=[features(r['smiles']) for r in rows];X=np.array([f[1] for f in training]);scale=np.std(X,axis=0);scale[scale==0]=1
    # Conservative support gate: observed feature ranges and molecular similarity. NOT empirically validated AD.
    if any(x[i]<X[:,i].min()-1e-10 or x[i]>X[:,i].max()+1e-10 for i in range(len(x))):return {**empty('OUTSIDE_OBSERVED_DESCRIPTOR_RANGES; no F/CF2/CF3 training data'),**common,'dataset_size':9}
    similarity=np.array([DataStructs.TanimotoSimilarity(fp,f[2]) for f in training]);nearest=float(max(similarity))
    if nearest<.25:return {**empty('LOW_FINGERPRINT_SUPPORT (<0.25); provisional rejection threshold'),**common,'dataset_size':9}
    def kernel(u,v,fu,fv):return math.exp(-np.mean(((u-v)/scale)**2))*DataStructs.TanimotoSimilarity(fu,fv)
    K=np.array([[kernel(fi[1],fj[1],fi[2],fj[2]) for fj in training] for fi in training]);y=np.array([r['value_ev'] for r in rows]);regularization=.1;center=y.mean();inv=np.linalg.inv(K+regularization*np.eye(len(y)));alpha=inv@(y-center);k=np.array([kernel(x,f[1],fp,f[2]) for f in training]);prediction=float(center+k@alpha)
    # Leave ONE MOLECULE out; temperatures never split across training/test here.
    errors=[]
    for i in range(len(rows)):
        keep=[j for j in range(len(rows)) if j!=i];mean=y[keep].mean();fold_scale=np.std(X[keep],axis=0);fold_scale[fold_scale==0]=1
        def fold_kernel(j,l):return math.exp(-np.mean(((X[j]-X[l])/fold_scale)**2))*DataStructs.TanimotoSimilarity(training[j][2],training[l][2])
        fold_K=np.array([[fold_kernel(j,l) for l in keep] for j in keep]);fold_k=np.array([fold_kernel(i,j) for j in keep]);p=mean+fold_k@np.linalg.solve(fold_K+regularization*np.eye(len(keep)),y[keep]-mean);errors.append(float(p-y[i]))
    rmse=float(np.sqrt(np.mean(np.square(errors))));mae=float(np.mean(np.abs(errors)));support=max(0.,1-float(k@inv@k));uncertainty=float(math.sqrt(rmse**2*(1+support)+max(r['uncertainty_ev'] for r in rows)**2))
    return {**common,'value_ev':prediction,'uncertainty_ev':uncertainty,'prediction_method':'EXPLORATORY_ESTIMATE','calculation_method':'MOLECULAR_DESCRIPTOR_MORGAN_KERNEL_RIDGE_ON_DERIVED_IGC_LABELS','applicability_domain':'PROVISIONAL_FEATURE_BOX_AND_TANIMOTO_SUPPORT','nearest_tanimoto':nearest,'dataset_size':9,'derived_rows_at_temperature':9,'in_sample':identity in {r['inchikey'] for r in rows},'validation_metrics':{'identity_leave_one_out_mae_ev':mae,'identity_leave_one_out_rmse_ev':rmse,'independent_external_test_count':0},'hyperparameters':{'ridge':regularization,'kernel':'exp(-mean standardized descriptor distance²) × Morgan Tanimoto','support_threshold':.25},'uncertainty_definition':'LOO residual + kernel support + source sensitivity; heuristic error estimate, NOT calibrated confidence interval','reason':'Very small, correlated derived dataset; same named TMS sample only. Not validated and not evidence for an arbitrary wafer.'}
def infer(payload):
    d=json.loads(DATA.read_text(encoding='utf-8'));profile=payload.get('profile','USER_SURFACE')
    if profile not in ['R2007_403K','R2007_423K']:return {'SiO2':empty('USER_WAFER_SURFACE_UNSPECIFIED; literature sample cannot be silently substituted'),'HMDS_SiO2':empty('USER_WAFER_SURFACE_UNSPECIFIED')}
    T=int(profile.split('_')[1][:-1]);smi=payload['smiles'];si=model(smi,'SiO2',T,d);hm=model(smi,'HMDS_SiO2',T,d)
    delta=None;error=None
    if si['value_ev'] is not None and hm['value_ev'] is not None:delta=hm['value_ev']-si['value_ev'];error=si['uncertainty_ev']+hm['uncertainty_ev'];hm.update(baseline_sio2_delta_g_ev=si['value_ev'],delta_delta_g_ev=delta,transfer_uncertainty_bound_ev=error,transfer_method='Difference of compatible published surface-specific lnK fits; no fixed HMDS offset; conservative uncertainty sum')
    references=[r for r in d['observations'] if r['temperature_k']==T and r['inchikey']==Chem.MolToInchiKey(Chem.MolFromSmiles(smi))]
    return {'SiO2':si,'HMDS_SiO2':hm,'delta_delta_g':{'value_ev':delta,'uncertainty_bound_ev':error,'definition':'G_HMDS_MINUS_G_SIO2','validation_status':'NOT_VALIDATED'},'literature_references':references,'profile':profile}
if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='build':d=build_dataset();print(json.dumps({'derived_rows':len(d['observations']),'independent_molecules':9,'status':'EXPLORATORY_NOT_VALIDATED'}))
    else:
        try:print(json.dumps(infer(json.load(sys.stdin)),allow_nan=False))
        except Exception as e:print(json.dumps({'error':str(e)}));sys.exit(1)
