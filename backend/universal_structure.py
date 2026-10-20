"""P1-G graph annotations. Counts are not additive adsorption energies."""
from collections import deque
from itertools import combinations
from rdkit import Chem,rdBase

VERSION='1.0.0'
PATTERNS={
 'alcohol':('[OX2H][CX4]','Hydroxyl bonded to sp3 carbon; excludes phenol and carboxylic acid.'),
 'phenol':('[OX2H][c]','Hydroxyl directly bonded to aromatic carbon.'),
 'carboxylic_acid':('[CX3](=[OX1])[OX2H1]','Neutral COOH; its OH is not alcohol/phenol.'),
 'carboxylate':('[CX3](=[OX1])[O-]','Deprotonated carboxylate, separate from neutral acid.'),
 'ester':('[CX3](=[OX1])[OX2H0][#6]','Carbonyl C-single O-carbon linkage; includes acrylate subtypes.'),
 'ether':('[OD2;!$([O][CX3]=O)]([#6])[#6]','C-O-C with O not directly bonded to a carbonyl carbon; excludes ester O.'),
 'carbonyl':('[CX3]=[OX1]','One C=O site, includes ester/acid/amide parent overlap.'),
 'amide':('[NX3][CX3](=[OX1])','N-carbonyl C linkage, excludes amine classification for that N.'),
 'amine':('[NX3;!$(N-C(=O));!$(N-S(=O)=O);!$(N=*)]','Neutral trivalent nonaromatic N; excludes amide, sulfonamide and imine N.'),
 'alkene':('[CX3]=[CX3]','Nonaromatic carbon-carbon double bond; parent overlap with acrylic motifs.'),
 'nitrile':('[#6]#[NX1]','Carbon-nitrogen triple bond.'),
 'acrylate':('[CH2]=[CH][CX3](=[OX1])[OX2H0][#6]','CH2=CH-C(=O)-O-C ester motif.'),
 'methacrylate':('[CH2]=[C]([CH3])[CX3](=[OX1])[OX2H0][#6]','CH2=C(CH3)-C(=O)-O-C ester motif.'),
 'acrylic_acid':('[CH2]=[CH][CX3](=[OX1])[OX2H1]','CH2=CH-COOH; separate from acrylate ester.'),
 'methacrylic_acid':('[CH2]=[C]([CH3])[CX3](=[OX1])[OX2H1]','CH2=C(CH3)-COOH; separate from methacrylate ester.'),
 'benzene':('c1ccccc1','All-carbon aromatic six-membered ring; may be part of fused aromatics.')}

def carbon_chains(mol):
    nodes={a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum()==6 and not a.IsInRing() and not a.GetIsAromatic()}
    edges={i:sorted(a.GetIdx() for a in mol.GetAtomWithIdx(i).GetNeighbors() if a.GetIdx() in nodes) for i in nodes}
    def bfs(start):
        parents={start:None};queue=deque([start]);last=start
        while queue:
            last=queue.popleft()
            for j in edges[last]:
                if j not in parents:parents[j]=last;queue.append(j)
        return last,parents
    unseen=set(nodes);components=[]
    while unseen:
        start=min(unseen);_,visited=bfs(start);component=sorted(visited);unseen.difference_update(component)
        a,_=bfs(start);b,parents=bfs(a);path=[b]
        while parents[path[-1]] is not None:path.append(parents[path[-1]])
        path.reverse();branches=[i for i in component if len(edges[i])>2]
        components.append(dict(atom_indices=component,carbon_count=len(component),longest_chain_atom_indices=path,
                               longest_chain_length=len(path),branch_atom_indices=branches,classification='BRANCHED' if branches else 'LINEAR',
                               is_long_chain=len(path)>=8))
    longest=max(components,key=lambda c:c['longest_chain_length'],default=None)
    return dict(definition='Exact longest path of the acyclic, nonaromatic carbon-only forest; C-C bonds of any order; ring carbons and paths across heteroatoms excluded. Length counts carbon atoms, not bonds.',
                long_chain_threshold_carbons=8,components=components,longest_chain_length=longest['longest_chain_length'] if longest else 0,
                longest_chain_atom_indices=longest['longest_chain_atom_indices'] if longest else [],
                linear_component_count=sum(c['classification']=='LINEAR' for c in components),branched_component_count=sum(c['classification']=='BRANCHED' for c in components),
                long_chain_component_count=sum(c['is_long_chain'] for c in components))

def analyze_universal_structure(mol,fluorine):
    features={};occurrences=[]
    for name,(smarts,definition) in PATTERNS.items():
        matches=sorted({tuple(sorted(m)) for m in mol.GetSubstructMatches(Chem.MolFromSmarts(smarts),uniquify=True)})
        items=[dict(id=f'{name}:{i}',atom_indices=list(m)) for i,m in enumerate(matches)]
        features[name]=dict(count=len(items),definition=definition,smarts=smarts,occurrences=items)
        occurrences.extend(dict(feature=name,**item) for item in items)
    rings=[tuple(r) for r in mol.GetRingInfo().AtomRings()]
    ring_records=[dict(id=f'ring:{i}',atom_indices=list(r),size=len(r),aromatic=all(mol.GetAtomWithIdx(j).GetIsAromatic() for j in r)) for i,r in enumerate(rings)]
    relations=[];adj={i:set() for i in range(len(rings))}
    for i,j in combinations(range(len(rings)),2):
        common=set(rings[i])&set(rings[j])
        if not common:continue
        bonds=[b.GetIdx() for b in mol.GetBonds() if b.GetBeginAtomIdx() in common and b.GetEndAtomIdx() in common]
        kind='SPIRO' if len(common)==1 else 'FUSED' if len(common)==2 and len(bonds)==1 else 'BRIDGED_OVERLAP' if len(common)>2 and len(bonds)>=2 else 'OTHER_OVERLAP'
        relations.append(dict(ring_ids=[f'ring:{i}',f'ring:{j}'],relationship=kind,shared_atom_indices=sorted(common),shared_bond_indices=bonds));adj[i].add(j);adj[j].add(i)
    systems=[];unseen=set(adj)
    while unseen:
        queue=[min(unseen)];component=set()
        while queue:
            i=queue.pop()
            if i in component:continue
            component.add(i);queue.extend(adj[i]-component)
        unseen.difference_update(component);ids=[f'ring:{i}' for i in sorted(component)]
        pair_rel=[r for r in relations if set(r['ring_ids']).issubset(ids)]
        systems.append(dict(ring_ids=ids,atom_indices=sorted(set().union(*(set(rings[i]) for i in component))),
                            fused=any(r['relationship']=='FUSED' for r in pair_rel),bridged=any(r['relationship']=='BRIDGED_OVERLAP' for r in pair_rel),
                            spiro=any(r['relationship']=='SPIRO' for r in pair_rel),aromatic_fused=all(ring_records[i]['aromatic'] for i in component) and len(component)>1 and any(r['relationship']=='FUSED' for r in pair_rel)))
    positions=[]
    for i,ring in enumerate(rings):
        if len(ring)!=6 or not ring_records[i]['aromatic']:continue
        attachments=[(a,n.GetIdx()) for a in ring for n in mol.GetAtomWithIdx(a).GetNeighbors() if n.GetIdx() not in ring]
        for (a,x),(b,y) in combinations(attachments,2):
            if a==b:continue
            d=abs(ring.index(a)-ring.index(b));d=min(d,6-d)
            positions.append(dict(ring_id=f'ring:{i}',attachment_atom_indices=[a,b],substituent_atom_indices=[x,y],ring_bond_distance=d,position={1:'ortho',2:'meta',3:'para'}[d]))
    overlaps=[];relative=[]
    for a,b in combinations(occurrences,2):
        shared=set(a['atom_indices'])&set(b['atom_indices'])
        if shared:
            kind='SAME_ATOMS' if set(a['atom_indices'])==set(b['atom_indices']) else 'CONTAINS' if set(a['atom_indices']).issuperset(b['atom_indices']) else 'WITHIN' if set(b['atom_indices']).issuperset(a['atom_indices']) else 'PARTIAL_OVERLAP'
            overlaps.append(dict(occurrence_ids=[a['id'],b['id']],relationship=kind,shared_atom_indices=sorted(shared)))
            distance=0
        else:
            paths=[Chem.GetShortestPath(mol,x,y) for x in a['atom_indices'] for y in b['atom_indices']]
            distances=[len(p)-1 for p in paths if p];distance=min(distances) if distances else None
        relative.append(dict(occurrence_ids=[a['id'],b['id']],shortest_bond_distance=distance))
    chains=carbon_chains(mol)
    summary={k:v['count'] for k,v in features.items()}
    summary.update(longest_carbon_chain=chains['longest_chain_length'],long_carbon_chain=chains['long_chain_component_count'],branched_carbon_chain=chains['branched_component_count'],
                   aromatic_ring=sum(r['aromatic'] for r in ring_records),aliphatic_ring=sum(not r['aromatic'] for r in ring_records),
                   fused_ring_system=sum(s['fused'] for s in systems),bridged_ring_system=sum(s['bridged'] for s in systems),spiro_ring_system=sum(s['spiro'] for s in systems),fused_aromatic_system=sum(s['aromatic_fused'] for s in systems))
    leaf_groups=['alcohol','phenol','carboxylic_acid','carboxylate','ester','ether','amide','amine','nitrile','alkene']
    return dict(analysis_id='P1G_UNIVERSAL_STRUCTURE',analysis_version=VERSION,status='SUCCESS',source_inchikey=Chem.MolToInchiKey(mol),rdkit_version=rdBase.rdkitVersion,
                organic_status='CARBON_CONTAINING' if any(a.GetAtomicNum()==6 for a in mol.GetAtoms()) else 'NO_CARBON',
                features=features,summary=summary,carbon_chains=chains,rings=ring_records,ring_relationships=relations,ring_systems=systems,
                aromatic_substitution_positions=positions,overlap_relationships=overlaps,functional_group_relations=relative,
                functional_group_types_present=[k for k in leaf_groups if features[k]['count']],is_multifunctional=sum(features[k]['count'] for k in leaf_groups)>1,
                fluorine=fluorine,counting_policy='Unique atom-set occurrences within each feature; parent/subtype overlaps explicitly recorded. Counts across different features must NOT be summed as energies.',
                ring_definition='RDKit SymmSSSR ring basis; FUSED pairs share exactly one edge, BRIDGED_OVERLAP pairs share a path of at least two edges, SPIRO pairs share one atom. Ring-system flags may overlap in complex polycycles.')
