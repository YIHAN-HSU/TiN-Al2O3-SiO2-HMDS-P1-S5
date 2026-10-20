"""B descriptors from the verified graph and original optimized conformer.
No force-field charges, Gasteiger values or geometry energies masquerade as quantum data.
"""
import math,hashlib
from rdkit import Chem,rdBase
from rdkit.Chem import Descriptors,rdMolDescriptors

VERSION='1.0.0'
def calculate_bridge_descriptors(mol,conformer=None,geometry=None):
    key=Chem.MolToInchiKey(mol)
    graph=dict(mw=Descriptors.MolWt(mol),mol_logp=Descriptors.MolLogP(mol),tpsa=rdMolDescriptors.CalcTPSA(mol),
               hbd=rdMolDescriptors.CalcNumHBD(mol),hba=rdMolDescriptors.CalcNumHBA(mol),
               heavy_atom_count=mol.GetNumHeavyAtoms(),rotatable_bonds=rdMolDescriptors.CalcNumRotatableBonds(mol),
               ring_count=rdMolDescriptors.CalcNumRings(mol),formal_charge=Chem.GetFormalCharge(mol))
    size=dict(status='NOT_CALCULATED',radius_of_gyration_angstrom=None,max_atom_distance_angstrom=None,
              max_heavy_atom_distance_angstrom=None,npr1=None,npr2=None,asphericity=None)
    provenance=dict(status='NOT_CALCULATED',engine=None,conformer_sha256=None,atom_count=None,energy_kcal_mol=None,
                    note='No optimized conformer supplied; no substitute coordinates.')
    if conformer is not None and conformer.GetNumConformers() and conformer.GetConformer().Is3D() and len(Chem.GetMolFrags(mol))==1:
        conf=conformer.GetConformer()
        points=[tuple(conf.GetAtomPosition(i)) for i in range(conformer.GetNumAtoms())]
        if not all(math.isfinite(v) for p in points for v in p):raise ValueError('BRIDGE_NON_FINITE_GEOMETRY')
        heavy=[p for i,p in enumerate(points) if conformer.GetAtomWithIdx(i).GetAtomicNum()>1]
        diameter=lambda ps:max((math.dist(a,b) for i,a in enumerate(ps) for b in ps[i+1:]),default=0.0)
        size.update(status='CALCULATED',radius_of_gyration_angstrom=rdMolDescriptors.CalcRadiusOfGyration(conformer),
                    max_atom_distance_angstrom=diameter(points),max_heavy_atom_distance_angstrom=diameter(heavy),
                    npr1=rdMolDescriptors.CalcNPR1(conformer),npr2=rdMolDescriptors.CalcNPR2(conformer),
                    asphericity=rdMolDescriptors.CalcAsphericity(conformer))
        if not all(math.isfinite(v) for v in size.values() if isinstance(v,(float,int))):raise ValueError('BRIDGE_NON_FINITE_SIZE')
        provenance=dict(status='CALCULATED',engine=(geometry or {}).get('conformer_engine'),
                        conformer_sha256=hashlib.sha256(Chem.MolToMolBlock(conformer).encode()).hexdigest(),
                        atom_count=conformer.GetNumAtoms(),energy_kcal_mol=(geometry or {}).get('conformer_energy'),
                        note='Same verified, hydrogen-complete original ETKDGv3/MMFF94s or UFF conformer; no re-embedding. Size is conformer dependent, not an adsorption geometry.')
    if len(Chem.GetMolFrags(mol))>1:
        size['reason']='Disconnected fragments have no defined relative geometry; aggregate size is NOT_CALCULATED.'
        if conformer is not None:
            provenance.update(status='CALCULATED',engine=(geometry or {}).get('conformer_engine'),atom_count=conformer.GetNumAtoms(),
                              conformer_sha256=hashlib.sha256(Chem.MolToMolBlock(conformer).encode()).hexdigest(),
                              energy_kcal_mol=(geometry or {}).get('conformer_energy'),note='Original fragment conformers retained; no physical interfragment placement or aggregate size claimed.')
    units={'dipole_moment':'debye','polarizability':'angstrom^3','local_charges':'elementary_charge','mep':'hartree/e'}
    electronic={k:dict(status='NOT_CALCULATED',value=None,unit=unit,method=None,backend=None,backend_version=None,
                       reference_dataset=None,source_inchikey=key,reason='No configured traceable quantum backend or validated electronic prediction model. RDKit force-field/Gasteiger values are not used as quantum descriptors.') for k,unit in units.items()}
    return dict(descriptor_id='P1F_BRIDGE_B',descriptor_version=VERSION,source_inchikey=key,rdkit_version=rdBase.rdkitVersion,
                physical_status='CALCULATED',physical=graph,size_3d=size,conformer=provenance,electronic=electronic,
                units={'mw':'g/mol','mol_logp':'dimensionless (RDKit Crippen estimate)','tpsa':'angstrom^2','hbd':'count','hba':'count'},
                electronic_status='NOT_CALCULATED')
