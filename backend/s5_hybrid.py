"""Quantity/context-gated numerical inference, with explicit untrained/unsupported branches.
Hybrid means selecting compatible evidence, never averaging electronic and Gibbs energies.
"""
from pathlib import Path
import json,sys,hashlib,math
import numpy as np
from rdkit import Chem
from rdkit.Chem import Descriptors,AllChem,rdMolDescriptors
from s5_numerical import infer as numerical_infer,features as numerical_features,FEATURES,DATA
from train_s5_hybrid import infer_model
ROOT=Path(__file__).resolve().parents[1];DATASET=ROOT/'reference/s5/hybrid/S5_HYBRID_DATASET.json';VERSION='P1-S5-HYBRID-1.0.0'
SMARTS={'Phenol':'[c][OX2H]','Alcohol':'[CX4][OX2H]','Ether':'[OX2]([#6;!$(C=O)])[#6;!$(C=O)]','Ester':'[CX3](=[OX1])[OX2][#6]','Carboxylic_Acid':'[CX3](=[OX1])[OX2H]','Ketone':'[#6][CX3](=[OX1])[#6]','Aldehyde':'[CX3H1](=[OX1])[#6]','Carbonyl':'[CX3]=[OX1]','Amine':'[NX3;!$(N[CX3]=O)]','Nitrile':'[CX2]#[NX1]','Acrylate':'[CH2]=[CH][CX3](=[OX1])[OX2][#6]','Methacrylate':'[CH2]=[C]([CH3])[CX3](=[OX1])[OX2][#6]','Fluoro':'F','CF2':'[C;$(C(F)F);!$(C(F)(F)F)]','CF3':'[C](F)(F)F'}
def descriptors(smi,geometry=None):
    m,x,fp=numerical_features(smi);groups={};indices={}
    for name,pattern in SMARTS.items():
        hits=m.GetSubstructMatches(Chem.MolFromSmarts(pattern));groups[name]=len(hits);indices[name]=[list(h) for h in hits]
    rings=[list(r) for r in m.GetRingInfo().AtomRings() if all(m.GetAtomWithIdx(i).GetIsAromatic() for i in r)];groups['Aromatic']=len(rings);indices['Aromatic']=rings
    shape={'status':'NOT_CALCULATED','reason':'No identity-verified existing 3D conformer supplied. No duplicate geometry generation is silently substituted.'}
    if geometry and geometry.get('is_real_3d') and geometry.get('mol_block'):
        try:
            g=Chem.MolFromMolBlock(geometry['mol_block'],removeHs=False)
            if g is None or g.GetNumConformers()!=1 or not g.GetConformer().Is3D() or Chem.MolToInchiKey(g)!=Chem.MolToInchiKey(m):raise ValueError('3D_IDENTITY_OR_COORDINATE_GATE_FAILED')
            shape=dict(status='CALCULATED',source='Existing identity-verified RDKit ETKDGv3 / force-field conformer; not a DFT geometry',molecular_volume_angstrom3=AllChem.ComputeMolVolume(g,gridSpacing=.2),volume_method='RDKit VDW occupancy grid; spacing 0.2 Angstrom',asphericity=rdMolDescriptors.CalcAsphericity(g),eccentricity=rdMolDescriptors.CalcEccentricity(g),radius_of_gyration_angstrom=rdMolDescriptors.CalcRadiusOfGyration(g),npr1=rdMolDescriptors.CalcNPR1(g),npr2=rdMolDescriptors.CalcNPR2(g),pmi1_amu_angstrom2=rdMolDescriptors.CalcPMI1(g),pmi2_amu_angstrom2=rdMolDescriptors.CalcPMI2(g),pmi3_amu_angstrom2=rdMolDescriptors.CalcPMI3(g))
            try:
                from rdkit.Chem import rdFreeSASA
                radii=[Chem.GetPeriodicTable().GetRvdw(a.GetAtomicNum()) for a in g.GetAtoms()];shape['solvent_accessible_area_angstrom2']=rdFreeSASA.CalcSASA(g,radii);shape['surface_area_method']='RDKit FreeSASA using RDKit elemental VDW radii and default 1.4 Angstrom probe; not adsorbate contact area'
            except Exception as e:shape['surface_area_status']='NOT_CALCULATED';shape['surface_area_reason']=str(e)
        except Exception as e:shape={'status':'NOT_CALCULATED','reason':str(e)}
    return dict(canonical_smiles=Chem.MolToSmiles(m),inchikey=Chem.MolToInchiKey(m),physical=dict(zip(FEATURES,x.tolist())),functional_groups=groups,atom_indices=indices,definitions=SMARTS,overlap_policy='Carbonyl includes ester/acid/ketone/aldehyde parents; ether excludes ester O; acrylate/methacrylate subtype overlap with ester is intentional. Counts are NOT additive energy terms.',fingerprint=dict(method='Morgan radius2 / 2048 bits',on_bits=list(fp.GetOnBits())),shape=shape,molar_refractivity_cm3_mol=Descriptors.MolMR(m),molar_refractivity_method='RDKit Crippen MolMR empirical optical descriptor; NOT quantum polarizability',electronic=dict(polarizability={'status':'NOT_CALCULATED','reason':'No independently verified quantum/validated electronic prediction available for this input; MolMR is not relabeled as polarizability.'}))
def infer(payload):
    smi=payload['smiles'];profile=payload.get('profile','USER_SURFACE');a=numerical_infer(dict(smiles=smi,profile=profile));extended=descriptors(smi,payload.get('geometry'));dataset=json.loads(DATASET.read_text());identity=extended['inchikey'];T=403 if profile=='R2007_403K' else 423 if profile=='R2007_423K' else None
    # New nonalkane numbers are DERIVED references, never claimed as predictions of unseen molecules.
    exact=[r for r in dataset['records'] if r['training_role']=='SIO2_EXACT_DERIVED_REFERENCE' and r['identity']==identity and r['temperature_k']==T]
    if len(exact)==1:
        r=exact[0];prior=a['SiO2'];a['SiO2']={**prior,'value_ev':r['value'],'uncertainty_ev':r['uncertainty_ev'],'uncertainty_definition':r['uncertainty_definition'],'prediction_method':'LITERATURE_REFERENCE','calculation_method':'COMPATIBLE_IGC_BASELINE_PLUS_RECONCILED_REPORTED_PROBE_DIFFERENCE','applicability_domain':'EXACT_REFERENCE_IDENTITY_AND_PUBLISHED_CONTEXT_ONLY','dataset_size':2,'validation_status':'NOT_VALIDATED','reason':'Derived 2007 reference, not a trained new-molecule predictor. Sign reconciled using independent Table5 arithmetic; table image audit remains pending.','reference_source':r,'in_sample':True};a.setdefault('literature_references',[]).append(r)
    hm=a['HMDS_SiO2']
    if T and hm['value_ev'] is not None and hm.get('calculation_method')!='PUBLISHED_IGC_NORMAL_ALKANE_LN_K_FIT':
        fitted=infer_model(smi,T)
        if fitted['value_ev'] is not None:hm.update(fitted,model_id='HMDS_Hybrid_DeltaG_Predictor',reason='Complete-molecule regularized regression selected by internal nested identity validation; named literature sample only. Not independently validated. No compatible B Gibbs labels were combined.')
        else:
            exact_tms=next((r for r in dataset['records'] if r['training_role']=='TMS_DIRECT_DERIVED_LABEL' and r['identity']==identity and r['temperature_k']==T),None)
            if exact_tms:hm.update(value_ev=exact_tms['value'],uncertainty_ev=float(exact_tms['original']['uncertainty_ev']),prediction_method='LITERATURE_REFERENCE',calculation_method='EXACT_DERIVED_IGC_REFERENCE_NOT_NEW_MOLECULE_PREDICTION',reference_source=exact_tms,reason='At this temperature the nested model selection failed the baseline gate; showing only the exact independently displayed derived literature reference. NOT_VALIDATED.')
            else:hm.update(fitted,prediction_method='NOT_AVAILABLE',reason=fitted['reason'],applicability_domain='MODEL_NOT_TRAINED')
    paired=next((r for r in dataset['paired_references'] if r['identity']==identity and r['temperature_k']==T),None)
    raw_data=json.loads(DATA.read_text());training=[numerical_features(r['smiles'])[1] for r in raw_data['observations'] if r['temperature_k']==(T or 403)];X=np.array(training);query=np.array([extended['physical'][k] for k in FEATURES]);violations=[dict(feature=k,query=float(query[i]),training_min=float(X[:,i].min()),training_max=float(X[:,i].max())) for i,k in enumerate(FEATURES) if query[i]<X[:,i].min()-1e-9 or query[i]>X[:,i].max()+1e-9]
    for surface in ['SiO2','HMDS_SiO2']:
        v=a[surface];v['base_model_id']=v.get('model_id');v['hybrid_predictor_id']='SiO2_Hybrid_DeltaG_Predictor' if surface=='SiO2' else 'HMDS_Hybrid_DeltaG_Predictor';v['hybrid_version']=VERSION;v['hybrid_fusion_status']='A_ONLY_NO_COMPATIBLE_CALCULATED_B_GIBBS';v['reason_codes']=[]
        v['model_id']=v['hybrid_predictor_id'];v['model_version']=VERSION;v['model_status']='REFERENCE_ONLY_NOT_A_NEW_MOLECULE_PREDICTION' if v['prediction_method']=='LITERATURE_REFERENCE' else 'EXPLORATORY_NOT_VALIDATED' if v['value_ev'] is not None else 'NOT_TRAINED_OR_UNSUPPORTED'
        if profile=='USER_SURFACE':v['reason_codes']+=['SURFACE_MODEL_NOT_DEFINED','NO_COMPATIBLE_DATA']
        elif v['value_ev'] is None:
            v['reason_codes']+=['NO_COMPATIBLE_DATA','MODEL_NOT_TRAINED']
            if violations:v['reason_codes'].append('OUT_OF_APPLICABILITY_DOMAIN')
        if v['value_ev'] is None:v['reason_codes']+=['DFT_NOT_COMPLETED','THERMODYNAMIC_CORRECTION_MISSING']
        v['reason_codes']=list(dict.fromkeys(v['reason_codes']));v['high_uncertainty']=v['value_ev'] is None and bool(violations);v['uncertainty_status']='HIGH_UNCERTAINTY_NOT_QUANTIFIED' if v['high_uncertainty'] else 'HEURISTIC_NOT_CALIBRATED' if v['uncertainty_ev'] is not None else 'NOT_QUANTIFIED';v['hybrid_diagnostics']=dict(dataset_id=dataset['id'],dataset_sha256=hashlib.sha256(DATASET.read_bytes()).hexdigest(),compatible_training_counts=dataset['counts'],descriptor_range_violations=violations,uncovered_functional_groups=[k for k in ['Phenol','Carboxylic_Acid','Acrylate','Methacrylate','Fluoro','CF2','CF3'] if extended['functional_groups'][k]>0],nonalkane_sio2_model_status='NOT_TRAINED_INSUFFICIENT_DATA',independent_external_validation_n=0)
    si,hm=a['SiO2'],a['HMDS_SiO2'];delta=hm['value_ev']-si['value_ev'] if si['value_ev'] is not None and hm['value_ev'] is not None else None
    if delta is not None:
        error=si['uncertainty_ev']+hm['uncertainty_ev'] if si['uncertainty_ev'] is not None and hm['uncertainty_ev'] is not None else None;hm.update(baseline_sio2_delta_g_ev=si['value_ev'],delta_delta_g_ev=delta,transfer_uncertainty_bound_ev=error);a['delta_delta_g']=dict(value_ev=delta,uncertainty_bound_ev=error,definition='G_HMDS_MINUS_G_SIO2',validation_status='NOT_VALIDATED',method='Difference of compatible named-sample exploratory outputs, not an independently trained universal transfer',independent_paired_reference=paired)
    a['hybrid']=dict(version=VERSION,descriptors=extended,dataset_counts=dataset['counts'],transfer=dict(id='HMDS_Surface_Transfer_Model',status='LIMITED_ALKANE_PHYSICAL_MODEL; NONALKANE_PAIRED_MODEL_NOT_TRAINED',paired_reference=paired,nonalkane_pair_count=2,reason='Two same-study nonalkane pairs do not justify general multifunctional/F/acrylate transfer. Normal-alkane surface-specific published fits remain executable.'),prediction_trace=[dict(stage='RDKit parsing / identity',status='PASS',identity=identity),dict(stage='Functional groups / descriptors',status='PASS',functional_groups=extended['functional_groups']),dict(stage='3D geometry descriptors',status=extended['shape']['status']),dict(stage='Literature and calculation quantity compatibility',status='PARTIAL',reason='Named source/T/reference-state partition; electronic Eads excluded from Gibbs targets.'),dict(stage='Surface-specific numerical inference',SiO2=si['prediction_method'],HMDS=hm['prediction_method']),dict(stage='Independent scientific validation',status='NOT_VALIDATED')])
    from s5_unknown import analyze as unknown_analysis
    unknown=unknown_analysis(smi,profile,extended,a);a['hybrid']['unknown_monomer']=unknown
    si,hm=a['SiO2'],a['HMDS_SiO2']
    delta=hm['value_ev']-si['value_ev'] if si['value_ev'] is not None and hm['value_ev'] is not None else None
    a.setdefault('delta_delta_g',{}).update(value_ev=delta,uncertainty_bound_ev=(si['uncertainty_ev']+hm['uncertainty_ev']) if delta is not None and si['uncertainty_ev'] is not None and hm['uncertainty_ev'] is not None else None)
    hm.update(delta_delta_g_ev=delta,baseline_sio2_delta_g_ev=si['value_ev'])
    a['hybrid']['prediction_trace'].append(dict(stage='Unknown-monomer similarity / surface / interaction / 3D support',version=unknown['version'],results={s:v['prediction_level'] for s,v in unknown['surfaces'].items()}))
    return a
if __name__=='__main__':
    try:print(json.dumps(infer(json.load(sys.stdin)),allow_nan=False))
    except Exception as e:print(json.dumps({'error':str(e)}));sys.exit(1)
