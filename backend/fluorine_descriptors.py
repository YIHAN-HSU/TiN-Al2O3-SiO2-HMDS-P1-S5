"""Graph-only fluorine descriptors; no adsorption coefficients."""
from rdkit import Chem, rdBase
from rdkit.Chem import Descriptors, rdMolDescriptors

def analyze_fluorine(mol):
    fluorines = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() == 9]
    carbons = [a for a in mol.GetAtoms() if a.GetAtomicNum() == 6]
    sites, assigned = [], set()
    for c in carbons:
        fs = [a.GetIdx() for a in c.GetNeighbors() if a.GetAtomicNum() == 9]
        if not fs: continue
        assigned.update(fs)
        n = len(fs)
        category = 'AROMATIC_C_F' if c.GetIsAromatic() else ('CF3' if n == 3 else 'CF2' if n == 2 else 'ALIPHATIC_C_F' if n == 1 else 'OTHER_C_F')
        sites.append(dict(carbon_index=c.GetIdx(), fluorine_indices=fs, category=category,
                          aromatic_cf3=n == 3 and any(a.GetIsAromatic() for a in c.GetNeighbors())))
    patterns = {'OH':'[OX2H;!$([O][CX3]=O)]','COOH':'[CX3](=O)[OX2H1]',
                'Ester':'[CX3](=O)[OX2H0][#6]', 'Ether':'[OD2;!$([O][CX3]=O)]([#6])[#6]'}
    groups = {k:[list(m) for m in mol.GetSubstructMatches(Chem.MolFromSmarts(s))] for k,s in patterns.items()}
    relations = []
    for site in sites:
        for group, matches in groups.items():
            for match in matches:
                paths = [Chem.GetShortestPath(mol,site['carbon_index'],i) if site['carbon_index'] != i else (i,) for i in match]
                distances = [len(p)-1 for p in paths if p]
                aromatic_positions=[]
                site_ar=[site['carbon_index']] if mol.GetAtomWithIdx(site['carbon_index']).GetIsAromatic() else [a.GetIdx() for a in mol.GetAtomWithIdx(site['carbon_index']).GetNeighbors() if a.GetIsAromatic()]
                group_ar=set(i for i in match if mol.GetAtomWithIdx(i).GetIsAromatic())
                for i in match:
                    if mol.GetAtomWithIdx(i).GetIsAromatic():continue
                    group_ar.update(a.GetIdx() for a in mol.GetAtomWithIdx(i).GetNeighbors() if a.GetIsAromatic())
                for ring in mol.GetRingInfo().AtomRings():
                    if len(ring)!=6 or not all(mol.GetAtomWithIdx(i).GetIsAromatic() for i in ring):continue
                    for a in site_ar:
                        for b in sorted(group_ar):
                            if a in ring and b in ring:
                                d=abs(ring.index(a)-ring.index(b));d=min(d,6-d)
                                aromatic_positions.append(dict(f_attachment_carbon=a,group_attachment_carbon=b,ring_atom_indices=list(ring),ring_bond_distance=d,position={0:'same_site',1:'ortho',2:'meta',3:'para'}[d]))
                relations.append(dict(carbon_index=site['carbon_index'], group=group, group_atom_indices=match,
                                      shortest_bond_distance=min(distances) if distances else None,aromatic_substitution_positions=aromatic_positions))
    counts = {k:sum(s['category'] == k for s in sites) for k in ['ALIPHATIC_C_F','AROMATIC_C_F','CF2','CF3','OTHER_C_F']}
    return dict(descriptor_id='RDKIT_F_GRAPH',descriptor_version='1.1.0',rdkit_version=rdBase.rdkitVersion,
                source_inchikey=Chem.MolToInchiKey(mol),has_fluorine=bool(fluorines),f_atom_count=len(fluorines),
                carbon_atom_count=len(carbons),fluorinated_carbon_count=len(sites),f_c_ratio=len(fluorines)/len(carbons) if carbons else None,
                fluorine_atom_indices=fluorines,carbon_bound_f_atom_count=len(assigned),
                non_carbon_bound_f_indices=sorted(set(fluorines)-assigned),classification=counts,
                aromatic_cf3_count=sum(s['aromatic_cf3'] for s in sites),sites=sites,functional_group_relations=relations,
                context_descriptors=dict(mw=Descriptors.MolWt(mol),tpsa=rdMolDescriptors.CalcTPSA(mol),mol_logp=Descriptors.MolLogP(mol)),
                geometry_usage='Graph distances only; 3D conformer separately available. No surface geometry calculated.')
