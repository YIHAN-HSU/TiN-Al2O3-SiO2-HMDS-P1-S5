"""Public input limits and reuse of existing descriptors. No adsorption formula."""
import sys,json
from rdkit import Chem
from rdkit import RDLogger
RDLogger.DisableLog('rdApp.*')
def run(p):
    if p.get('action')=='sdf_options':
        import io
        from rdkit.Chem import Descriptors,rdMolDescriptors
        options=[]
        for i,m in enumerate(Chem.ForwardSDMolSupplier(io.BytesIO(p['sdf_text'].encode('utf-8')),removeHs=False)):
            if m is None or m.GetNumHeavyAtoms()>80 or m.GetNumAtoms()>240: raise ValueError('INVALID_SDF')
            options.append(dict(index=i,title=m.GetProp('_Name') if m.HasProp('_Name') and m.GetProp('_Name') else 'Molecule '+str(i+1),formula=rdMolDescriptors.CalcMolFormula(m),molecular_weight=Descriptors.MolWt(m),canonical_smiles=Chem.MolToSmiles(Chem.RemoveHs(m)),mol_block=Chem.MolToMolBlock(m)))
        if not options or len(options)>32:raise ValueError('INVALID_SDF')
        return {'options':options}
    if p.get('action')=='descriptors':
        from s5_hybrid import descriptors
        return descriptors(p['smiles'],p.get('geometry'))
    kind=p['input_type'].lower();s=p['input_data']
    m=Chem.MolFromSmiles(s.strip()) if kind=='smiles' else Chem.MolFromInchi(s.strip()) if kind=='inchi' else Chem.MolFromMolBlock(s.split('$$$$')[0],removeHs=False)
    if m is None: return {'ok':False,'code':'INVALID_MOLECULE'}
    if m.GetNumHeavyAtoms()>int(p.get('maximum_heavy_atoms',80)) or m.GetNumAtoms()>240: return {'ok':False,'code':'MOLECULE_TOO_LARGE'}
    return {'ok':True}
if __name__=='__main__':
    try: print(json.dumps(run(json.load(sys.stdin)),allow_nan=False))
    except Exception: print(json.dumps({'ok':False,'code':'INVALID_MOLECULE'}));sys.exit(1)
