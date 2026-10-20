"""Deterministic assumed scenarios in SU. Never a physical energy/Gibbs model."""
from pathlib import Path
import json,sys,math,hashlib,itertools
from rdkit import Chem,rdBase
from rdkit.Chem import Descriptors,Lipinski,rdMolDescriptors,rdFingerprintGenerator,AllChem
CONFIG=Path(__file__).resolve().parents[1]/'models/s5/hypothetical.json'
PATTERNS={
 'Alcohol':'[CX4][OX2H]','Phenol':'[c][OX2H]','Ether':'[OX2;!$([O][CX3]=O)]([#6])[#6]',
 'Ester':'[CX3](=[OX1])[OX2H0][#6]','Carbonyl':'[CX3]=[OX1]','Ketone':'[#6][CX3](=[OX1])[#6]',
 'Aldehyde':'[CX3H1](=[OX1])[#6]','Carboxylic_Acid':'[CX3](=[OX1])[OX2H]','Amide':'[CX3](=[OX1])[NX3]',
 'Acrylate':'[CH2]=[CH][CX3](=[OX1])[OX2H0][#6]','Methacrylate':'[CH2]=[C]([CH3])[CX3](=[OX1])[OX2H0][#6]',
 'Vinyl_Ether':'[CH2]=[CH][OX2][#6;!$(C=O)]','Allyl_Ether':'[CH2]=[CH][CX4][OX2][#6;!$(C=O)]',
 'Benzene':'c1ccccc1','Norbornene':'C1=CC2CCC1C2',
 'EO_Unit':'[O]-[CH2;!R]-[CH2;!R]-[O]',
}
def read_config():return json.loads(CONFIG.read_text(encoding='utf-8'))
def number(x):return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
def resolve(config,preset='BASELINE',overrides=None):
    if preset not in config['presets']:raise ValueError('UNKNOWN_ASSUMPTION_SET')
    if overrides is not None and not isinstance(overrides,dict):raise ValueError('ASSUMPTION_OVERRIDES_MUST_BE_OBJECT')
    params={k:r['value'] for k,r in config['parameters'].items()};params.update(config['presets'][preset])
    for k,v in (overrides or {}).items():
        if k not in params:raise ValueError('UNKNOWN_ASSUMED_PARAMETER:'+k)
        r=config['parameters'][k]
        if not number(v) or not r['minimum']<=v<=r['maximum']:raise ValueError('INVALID_PARAMETER_RANGE:'+k)
        params[k]=v
    if not all(number(v) and config['parameters'][k]['minimum']<=v<=config['parameters'][k]['maximum'] for k,v in params.items()):raise ValueError('NONFINITE_OR_OUT_OF_RANGE_ASSUMPTION_CONFIG')
    if any(v<=0 for k,v in params.items() if k.endswith('_scale')):raise ValueError('NORMALIZATION_SCALES_MUST_BE_POSITIVE')
    return params
def extract(smi,shape=None,config=None):
    config=config or read_config()
    try:
        mol=Chem.MolFromSmiles(smi,sanitize=False)
        if mol is None:raise ValueError('SYNTAX_OR_RING_CLOSURE_INVALID')
        Chem.SanitizeMol(mol);Chem.AssignStereochemistry(mol,cleanIt=True,force=True)
        mol=Chem.MolFromSmiles(Chem.MolToSmiles(mol,isomericSmiles=True))
    except Exception as e:raise ValueError('SMILES_PARSING_OR_SANITIZATION_FAILED:'+str(e)) from e
    if len(Chem.GetMolFrags(mol))!=1 or not any(a.GetAtomicNum()==6 for a in mol.GetAtoms()):raise ValueError('UNSUPPORTED_CHEMISTRY_REQUIRES_SINGLE_CONNECTED_ORGANIC_MOLECULE')
    if any(a.GetSymbol() not in config['supported_elements'] or a.GetFormalCharge()!=0 or a.GetNumRadicalElectrons()!=0 for a in mol.GetAtoms()):raise ValueError('UNSUPPORTED_CHEMISTRY_NEUTRAL_CLOSED_SHELL_ELEMENTS_ONLY')
    if mol.GetNumHeavyAtoms()>config['maximum_heavy_atoms']:raise ValueError('DECLARED_HEAVY_ATOM_RESOURCE_LIMIT_EXCEEDED')
    groups={};indices={}
    for name,smarts in PATTERNS.items():
        matches=mol.GetSubstructMatches(Chem.MolFromSmarts(smarts),uniquify=True)
        atom_sets=sorted({tuple(sorted(m)) for m in matches});indices[name]=[list(x) for x in atom_sets];groups[name]=len(atom_sets)
    # Count ether oxygens once; an ester oxygen is not an independent ether.
    ether_indices=sorted({m[0] for m in mol.GetSubstructMatches(Chem.MolFromSmarts(PATTERNS['Ether']))})
    groups['Ether']=len(ether_indices);indices['Ether_Oxygen']=[[i] for i in ether_indices]
    rings=[tuple(r) for r in mol.GetRingInfo().AtomRings()];ar=[r for r in rings if all(mol.GetAtomWithIdx(i).GetIsAromatic() for i in r)]
    relation=[]
    for i,j in itertools.combinations(range(len(rings)),2):
        common=set(rings[i])&set(rings[j]);bonds=[b for b in mol.GetBonds() if b.GetBeginAtomIdx() in common and b.GetEndAtomIdx() in common]
        if common:relation.append(dict(rings=[i,j],kind='SPIRO' if len(common)==1 else 'FUSED' if len(common)==2 and len(bonds)==1 else 'BRIDGED_OVERLAP' if len(common)>=3 else 'OTHER',shared_atoms=sorted(common)))
    groups.update(Aromatic_Ring=len(ar),Cycloalkyl=sum(not any(mol.GetAtomWithIdx(i).GetIsAromatic() for i in r) and all(mol.GetAtomWithIdx(i).GetAtomicNum()==6 for i in r) for r in rings),Fused_Bicyclic=sum(r['kind']=='FUSED' for r in relation),Bridged_Bicyclic=sum(r['kind']=='BRIDGED_OVERLAP' for r in relation),Fused_Aromatic_Ring=sum(r['kind']=='FUSED' and all(i in [rings.index(x) for x in ar] for i in r['rings']) for r in relation),Alicyclic_Ether=sum(mol.GetAtomWithIdx(i).IsInRing() for i in ether_indices))
    f_atoms=[a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum()==9];cf={a.GetIdx():sum(n.GetAtomicNum()==9 for n in a.GetNeighbors()) for a in mol.GetAtoms() if a.GetAtomicNum()==6};cf2=[i for i,n in cf.items() if n==2];cf3=[i for i,n in cf.items() if n==3]
    carbon_f=[i for i in f_atoms if any(n.GetAtomicNum()==6 for n in mol.GetAtomWithIdx(i).GetNeighbors())];ar_f=[i for i in carbon_f if any(n.GetIsAromatic() for n in mol.GetAtomWithIdx(i).GetNeighbors())];ar_cf3=[i for i in cf3 if any(n.GetIsAromatic() for n in mol.GetAtomWithIdx(i).GetNeighbors())]
    fully_f={i for i,n in cf.items() if n and mol.GetAtomWithIdx(i).GetTotalNumHs()==0 and not mol.GetAtomWithIdx(i).GetIsAromatic()};unseen=set(fully_f);perfluoro=[]
    while unseen:
        stack=[min(unseen)];component=set()
        while stack:
            i=stack.pop()
            if i in component:continue
            component.add(i);stack.extend(n.GetIdx() for n in mol.GetAtomWithIdx(i).GetNeighbors() if n.GetIdx() in fully_f and n.GetIdx() not in component)
        unseen-=component
        if len(component)>=2:perfluoro.append(sorted(component))
    alkenes=[b for b in mol.GetBonds() if b.GetBondType()==Chem.BondType.DOUBLE and b.GetBeginAtom().GetAtomicNum()==6 and b.GetEndAtom().GetAtomicNum()==6 and not b.GetIsAromatic()];terminal=[b for b in alkenes if any(a.GetTotalNumHs()>=2 for a in [b.GetBeginAtom(),b.GetEndAtom()])]
    groups.update(Fluorine_Atom=len(f_atoms),C_F=len(carbon_f),CF2=len(cf2),CF3=len(cf3),Aromatic_F=len(ar_f),Aromatic_CF3=len(ar_cf3),Perfluoroalkyl=len(perfluoro),Fluorinated_Ester=groups['Ester'] if f_atoms else 0,Fluorinated_Alcohol=groups['Alcohol'] if f_atoms else 0,Terminal_Alkene=len(terminal),Internal_Alkene=len(alkenes)-len(terminal),Multifunctional_Acrylate=int(groups['Acrylate']+groups['Methacrylate']>=2),Aromatic_Ether=sum(any(n.GetIsAromatic() for n in mol.GetAtomWithIdx(i).GetNeighbors()) for i in ether_indices))
    # Alcohol OH attached to a terminal carbon: carbon has one heavy-atom neighbour excluding OH.
    groups['Terminal_Alcohol']=sum(sum(n.GetAtomicNum()>1 and n.GetIdx()!=hit[1] for n in mol.GetAtomWithIdx(hit[0]).GetNeighbors())<=1 for hit in mol.GetSubstructMatches(Chem.MolFromSmarts(PATTERNS['Alcohol'])))
    groups['Aromatic_Ester']=sum(any(n.GetIsAromatic() for i in [hit[0],hit[2]] for n in mol.GetAtomWithIdx(i).GetNeighbors()) for hit in mol.GetSubstructMatches(Chem.MolFromSmarts(PATTERNS['Ester'])))
    indices['Phenyl']=[r for r in indices['Benzene'] if any(n.GetIdx() not in r and not mol.GetBondBetweenAtoms(i,n.GetIdx()).IsInRing() for i in r for n in mol.GetAtomWithIdx(i).GetNeighbors())];groups['Phenyl']=len(indices['Phenyl']);
    groups['Vinyl_Ether_End_Group']=groups['Vinyl_Ether'];indices.update(Fluorine_Atom=[[i] for i in f_atoms],CF2=[[i] for i in cf2],CF3=[[i] for i in cf3],Aromatic_F=[[i] for i in ar_f],Aromatic_CF3=[[i] for i in ar_cf3],Perfluoroalkyl=perfluoro)
    physical=dict(MW=Descriptors.MolWt(mol),LogP=Descriptors.MolLogP(mol),TPSA=rdMolDescriptors.CalcTPSA(mol),HBD=Lipinski.NumHDonors(mol),HBA=Lipinski.NumHAcceptors(mol),RB=Lipinski.NumRotatableBonds(mol),Aromatic_Rings=len(ar),Alicyclic_Rings=rdMolDescriptors.CalcNumAliphaticRings(mol),Bridgeheads=rdMolDescriptors.CalcNumBridgeheadAtoms(mol),Heavy_Atoms=mol.GetNumHeavyAtoms(),Carbon_Atoms=sum(a.GetAtomicNum()==6 for a in mol.GetAtoms()),Double_Bonds=sum(b.GetBondType()==Chem.BondType.DOUBLE for b in mol.GetBonds()),CC_Double_Bonds=len(alkenes),Small_Rings=sum(len(r)<=4 for r in rings),FractionCSP3=rdMolDescriptors.CalcFractionCSP3(mol))
    if not all(number(v) for v in physical.values()):raise ValueError('NECESSARY_DESCRIPTOR_FAILED_OR_NONFINITE')
    descriptor_status={k:dict(status='DESCRIPTOR_ESTIMATED' if k=='LogP' else 'DESCRIPTOR_AVAILABLE',value=v,method='RDKit Crippen estimate' if k=='LogP' else 'RDKit graph descriptor') for k,v in physical.items()}
    optional={}
    for key in ['molecular_volume_angstrom3','solvent_accessible_area_angstrom2','radius_of_gyration_angstrom','asphericity']:
        value=(shape or {}).get(key);ok=number(value)
        optional[key]=dict(value=value if ok else None,status='DESCRIPTOR_ESTIMATED' if ok else 'DESCRIPTOR_FAILED',method='Existing identity-verified RDKit force-field conformer; conformer-dependent' if ok else 'No usable existing 3D descriptor; optional term not applied',source_status=(shape or {}).get('status','NOT_SUPPLIED'),source_reason=(shape or {}).get('reason'))
    optional.update(polarizability=dict(value=None,status='DESCRIPTOR_FAILED',reason='No traceable quantum/validated polarizability; MolMR is not relabeled.'),partial_charges=dict(value=None,status='DESCRIPTOR_FAILED',reason='No quantum charge backend; no fake zero or Gasteiger-as-quantum substitution.'),ring_strain_energy=dict(value=None,status='DESCRIPTOR_FAILED',reason='Small-ring/bridgehead topology is a steric proxy, not calculated strain energy.'))
    try:
        charged=Chem.Mol(mol);AllChem.ComputeGasteigerCharges(charged,throwOnParamFailure=True);charges=[float(a.GetProp('_GasteigerCharge')) for a in charged.GetAtoms()];hydrogens=[float(a.GetProp('_GasteigerHCharge')) for a in charged.GetAtoms()]
        if not all(number(v) for v in charges+hydrogens):raise ValueError('NONFINITE_EMPIRICAL_CHARGES')
        optional['partial_charges']=dict(value=dict(minimum=min(charges),maximum=max(charges),mean_absolute=math.fsum(abs(v) for v in charges)/len(charges),total_with_implicit_h=math.fsum(charges+hydrogens)),status='DESCRIPTOR_ESTIMATED',method='RDKit Gasteiger empirical partial charges, NOT quantum chemistry; not used as an adsorption-energy correction')
    except Exception as e:optional['partial_charges']=dict(value=None,status='DESCRIPTOR_FAILED',reason='Empirical charge calculation failed: '+str(e))
    fp=rdFingerprintGenerator.GetMorganGenerator(radius=2,fpSize=2048,includeChirality=True).GetFingerprint(mol)
    return dict(canonical_smiles=Chem.MolToSmiles(mol,isomericSmiles=True),inchikey=Chem.MolToInchiKey(mol),rdkit_version=rdBase.rdkitVersion,physical=physical,descriptor_status=descriptor_status,groups=groups,atom_indices=indices,smarts=PATTERNS,rings=[list(r) for r in rings],ring_relationships=relation,optional_descriptors=optional,fingerprint=dict(method='Morgan radius2 / 2048 / chirality',on_bits=list(fp.GetOnBits())),definitions=dict(EO_Unit='One non-ring CH2-CH2 pair flanked by O atoms; ester boundary O allowed as chain anchor, not counted as ether.',Fluorinated_Ester='Ester and F coexist in this connected molecule; not necessarily local substitution.',Perfluoroalkyl='Connected component of at least two F-bearing nonaromatic carbons with no H; O linkage at component boundary allowed.',Ring_Analysis='SymmSSSR basis; fused/bridged/spiro pair flags are annotations, not strain energies.',Overlap='Carbonyl/ester/acrylate and EO annotations can overlap; ether oxygen excludes ester. Counts are not additive energies.'))
def score_pair(d,p):
    x=d['physical'];g=d['groups'];sat=lambda v,scale:v/(v+scale)
    size=sat(x['MW'],p['global.mw_scale']);polar=sat(x['TPSA'],p['global.tpsa_scale']);hb=math.tanh((x['HBD']+x['HBA'])/p['global.hb_scale']);flex=sat(x['RB'],p['global.rot_scale']);ar=sat(x['Aromatic_Rings'],p['global.ring_scale']);steric=sat(x['Bridgeheads']+x['Small_Rings'],p['global.steric_scale']);co=sat(g['Carbonyl'],p['global.carbonyl_scale']);hydro=math.tanh(x['LogP']/p['global.logp_scale']);f=(g['Fluorine_Atom']/(g['Fluorine_Atom']+x['Carbon_Atoms']))*(1+g['CF3']/x['Carbon_Atoms'])
    contact=4*size*(1-size);access=1/(1+steric+p['global.fold_coupling']*flex*size);out={}
    for s in ['SiO2','HMDS_SiO2']:
        v=lambda name:p[s+'.'+name];coverage=v('tms_coverage');oh=v('oh_activity')*(1-coverage);surface_pol=v('surface_polarity');mismatch=(polar-surface_pol)**2
        terms=dict(dispersion=-v('dispersion')*contact*access*(1+p['global.aromatic_coupling']*ar),polar=-v('polar')*polar*surface_pol*contact*access,hbond=-v('hbond')*hb*oh*access*contact,carbonyl=-v('carbonyl')*co*oh*polar*access,hydrophobic=-v('hydrophobic')*hydro*(coverage+1-surface_pol)*contact*access,fluorine=v('fluorine')*f*(1+polar*oh)*access,packing=v('packing')*size**2*(steric+mismatch),steric=v('steric')*steric*size*(1+flex),flexibility=v('flexibility')*flex**2*size,oh_crowding=v('oh_crowding')*sat(x['HBD'],p['global.hb_scale'])**2*polar*(1-access))
        volume=d['optional_descriptors']['molecular_volume_angstrom3']['value']
        if volume is not None:terms['optional_shape']=v('shape')*sat(volume,p['global.volume_scale'])*size*(steric+flex)
        value=math.fsum(terms.values())
        if not number(value):raise ValueError('NONFINITE_HYPOTHETICAL_OUTPUT')
        out[s]=dict(model_id='SIO2_HYPOTHETICAL_MODEL' if s=='SiO2' else 'HMDS_HYPOTHETICAL_MODEL',score_su=value,terms_su=terms,optional_shape_term_status='APPLIED' if volume is not None else 'OPTIONAL_DESCRIPTOR_FAILED_TERM_NOT_APPLIED')
    return out,dict(size=size,polarity=polar,hbond=hb,flexibility=flex,aromatic=ar,steric_proxy=steric,carbonyl=co,hydrophobic=hydro,fluorine_topology=f,contact_window=contact,accessibility=access)
def simulate(payload):
    config=read_config();preset=payload.get('assumption_set','BASELINE');overrides=payload.get('parameter_overrides',{});params=resolve(config,preset,overrides);d=extract(payload['smiles'],payload.get('shape'),config);base,normalized=score_pair(d,params)
    trials=[dict(parameter='BASELINE',value=None,scores={s:r['score_su'] for s,r in base.items()})]
    for key,r in config['parameters'].items():
        if r['role']!='MODEL_PARAMETER' or r['minimum']==r['maximum']:continue
        for endpoint in ['minimum','maximum']:
            varied={**params,key:r[endpoint]};scores,_=score_pair(d,varied);trials.append(dict(parameter=key,value=r[endpoint],endpoint=endpoint,scores={s:r['score_su'] for s,r in scores.items()}))
    for s,row in base.items():
        low=min(t['scores'][s] for t in trials);high=max(t['scores'][s] for t in trials);relative=(high-low)/(1+abs(row['score_su']));category='HIGH' if relative>=params['sensitivity.high_threshold'] else 'MEDIUM' if relative>=params['sensitivity.medium_threshold'] else 'LOW';row.update(unit='Scenario Unit (SU)',status=config['status'],sensitivity=dict(minimum_su=low,maximum_su=high,relative_sampled_span=relative,category=category+'_ASSUMPTION_SENSITIVITY',method=config['sensitivity_method']),surface_assumptions={k.split('.',1)[1]:v for k,v in params.items() if k.startswith(s+'.')})
    differences=[t['scores']['HMDS_SiO2']-t['scores']['SiO2'] for t in trials]
    return dict(engine_id=config['id'],version=config['version'],status=config['status'],unit=config['unit'],descriptors=d,surfaces=base,surface_difference=dict(value_su=base['HMDS_SiO2']['score_su']-base['SiO2']['score_su'],minimum_sampled_su=min(differences),maximum_sampled_su=max(differences),definition='HMDS_HYPOTHETICAL_SCORE_MINUS_SIO2_HYPOTHETICAL_SCORE; SU ONLY; not delta-delta-G'),assumption_set=preset,parameter_overrides=overrides,resolved_parameters=params,config_sha256=hashlib.sha256(CONFIG.read_bytes()).hexdigest(),normalized_features=normalized,sensitivity_trials=trials,descriptor_coverage=dict(mandatory='DESCRIPTOR_AVAILABLE',optional_failed=[k for k,v in d['optional_descriptors'].items() if v['status']=='DESCRIPTOR_FAILED']),extrapolation_warning='No empirical adsorption calibration anywhere in this scenario model; an SU score is not a physical energy even for a literature-known molecule.',limitations=['Assumed mathematical structure and parameters; no statistical prediction error or confidence interval.','No measured surface OH/polarity/coverage or physical contact geometry.','Steric/ring proxies are not strain/quantum energies; no SU-to-eV calibration.','OAT sensitivity is a sampled envelope, not simultaneous bounds.'],calibration='NONE; NOT_PHYSICAL_DELTA_G')
if __name__=='__main__':
    try:print(json.dumps(simulate(json.load(sys.stdin)),allow_nan=False))
    except Exception as e:print(json.dumps({'error':str(e),'status':'HYPOTHETICAL_FAILED'}));sys.exit(1)
