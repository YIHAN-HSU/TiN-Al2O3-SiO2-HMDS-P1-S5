"""Portability/identity adapter. The authoritative v1.2 module stays byte-identical.
No energy formula here: predictions and contribution locals come from the source.
"""
import sys,json,pathlib,importlib.util,hashlib,math,ast,inspect
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors,Draw
f_spec=importlib.util.spec_from_file_location('fluorine_descriptors',pathlib.Path(__file__).resolve().parent/'fluorine_descriptors.py')
f_module=importlib.util.module_from_spec(f_spec);f_spec.loader.exec_module(f_module)
analyze_fluorine=f_module.analyze_fluorine
b_spec=importlib.util.spec_from_file_location('bridge_descriptors',pathlib.Path(__file__).resolve().parent/'bridge_descriptors.py')
b_module=importlib.util.module_from_spec(b_spec);b_spec.loader.exec_module(b_module)
calculate_bridge_descriptors=b_module.calculate_bridge_descriptors
u_spec=importlib.util.spec_from_file_location('universal_structure',pathlib.Path(__file__).resolve().parent/'universal_structure.py')
u_module=importlib.util.module_from_spec(u_spec);u_spec.loader.exec_module(u_module)
analyze_universal_structure=u_module.analyze_universal_structure
g_spec=importlib.util.spec_from_file_location('universal_descriptors',pathlib.Path(__file__).resolve().parent/'universal_descriptors.py')
g_module=importlib.util.module_from_spec(g_spec);g_spec.loader.exec_module(g_module)
calculate_universal_descriptors=g_module.calculate_universal_descriptors
p=pathlib.Path(__file__).resolve().parent/'rdkit_engine_v12.py'
spec=importlib.util.spec_from_file_location('authority_v12',p)
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
FORMULA_HASH=hashlib.sha256(p.read_bytes()).hexdigest()

def inchi_key(inchi):
 return Chem.InchiToInchiKey(inchi) if inchi else ''
SOURCE_MOL=None
def identity_helper(smiles=None,mol_block=None):
 mol=Chem.MolFromMolBlock(mol_block,removeHs=False) if mol_block else (SOURCE_MOL if SOURCE_MOL is not None else Chem.MolFromSmiles(smiles))
 if mol is None:return ('','')
 inchi=Chem.MolToInchi(mol);return inchi,inchi_key(inchi)
# Windows OpenBabel wheel lacks InChI plugin. RDKit's official InChI replaces
# only identity conversion; extraction, formulas and geometry are untouched.
engine.compute_inchikey_from_inchi=inchi_key
engine.compute_inchi_and_key_from_smiles_or_block=identity_helper

def metadata(pred):
 result=dict(pred)
 result.update(model_id='AL2O3_ZIP12_GC_V1.2',model_version='v1.2',surface_id='AL2O3_HYDROXYLATED_ALPHA_0001_ZIP12',formula_hash=FORMULA_HASH,
  confidence='NOT_ESTABLISHED',uncertainty_ev=None,applicability_domain='NOT_ESTABLISHED',is_out_of_domain=False,
  calibration_status='NOT_QUANTITATIVELY_CALIBRATED',dft_status='NOT_CALCULATED',
  model_name='Hydroxylated α-Al₂O₃(0001) — v1.2 Eads Screening Model',prediction_method='EXISTING_V1.2_SCREENING_MODEL',surface_state='HYDROXYLATED',
  domain_note='Empirical applicability and uncertainty are NOT_ESTABLISHED. No DFT was executed.',
  warning='EXPLORATORY. NOT QUANTITATIVELY CALIBRATED. Original reference entries do not establish validation.',
  energy_reference='NOT SPECIFIED',energy_definition='NOT SPECIFIED',surface_model_version='v1.2',
  surface_assumptions='Hydroxylated alpha-Al2O3(0001); OH coverage NOT SPECIFIED')
 return result

def predict(mol):
 features=engine.extract_molecular_features(Chem.RemoveHs(mol));captured={}
 def trace(frame,event,arg):
  if frame.f_code is engine.predict_eads_ml.__code__ and event=='return':captured.update(frame.f_locals)
 sys.setprofile(trace)
 try:original=engine.predict_eads_ml(features)
 finally:sys.setprofile(None)
 contributions={k:v for k,v in captured.items() if k.startswith('e_') and isinstance(v,(float,int))}
 effective={};expressions={}
 # Read effective-count expressions from the original AST, not a second formula.
 tree=ast.parse(inspect.getsource(engine.predict_eads_ml))
 for node in ast.walk(tree):
  if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name):
   key=node.targets[0].id
   if key in contributions:
    expressions[key]=ast.unparse(node.value)
    if key not in ('e_disp','e_polar') and isinstance(node.value,ast.BinOp):
     effective[key]=eval(compile(ast.Expression(node.value.right),'<original-effective-count>','eval'),{'min':min},captured)
 out=metadata(original)
 out.update(original_metadata=original,features=features,functional_group_contributions=contributions,effective_counts=effective,contribution_expressions=expressions,
  source_inchikey=Chem.MolToInchiKey(mol),installed=True,status_code='SUCCESS',status='SUCCESS',
  predicted_eads_display=f"{original['raw_predicted_eads_ev']:.2f} eV",relative_affinity_score=None,affinity_class='NOT_ESTABLISHED')
 if not all(math.isfinite(float(v)) for k,v in features.items() if isinstance(v,(float,int))):raise ValueError('NON_FINITE_DESCRIPTOR')
 if not math.isfinite(out['raw_predicted_eads_ev']):raise ValueError('NON_FINITE_EADS')
 out['fluorine']=analyze_fluorine(mol)
 out['bridge_descriptors']=calculate_bridge_descriptors(mol)
 out['universal_structure']=analyze_universal_structure(mol,out['fluorine'])
 out['universal_descriptors']=calculate_universal_descriptors(mol,out['bridge_descriptors'])
 return out

def parse(payload):
 kind=payload.get('input_type','smiles').lower();text=payload.get('input_data','')
 if not text or not isinstance(text,str):raise ValueError('EMPTY_INPUT')
 if kind=='inchi':mol=Chem.MolFromInchi(text,removeHs=False)
 elif kind in ('mdl','mol','sdf'):
  blocks=[b for b in text.split('$$$$') if b.strip()]
  if len(blocks)!=1:raise ValueError('MULTI_MOLECULE_SDF_SELECT_ONE_RECORD')
  mol=Chem.MolFromMolBlock(blocks[0],removeHs=False)
 else:mol=Chem.MolFromSmiles(text)
 if mol is None:raise ValueError('INVALID_MOLECULE')
 Chem.SanitizeMol(mol);mol=Chem.RemoveHs(mol)
 key=Chem.MolToInchiKey(mol)
 if not key:raise ValueError('INCHIKEY_NOT_AVAILABLE')
 if payload.get('expected_inchikey') and key!=payload['expected_inchikey']:raise ValueError('MOLECULAR_IDENTITY_MISMATCH')
 isomeric=Chem.MolToSmiles(mol,isomericSmiles=True)
 # Original smiles route deliberately used to execute AddHs/ETKDG/force field,
 # even for an imported MDL. Original native-MDL zero-energy shortcut is avoided.
 global SOURCE_MOL
 SOURCE_MOL=mol
 enabled=payload.get('prediction_enabled',True)
 original_predict=engine.predict_eads_ml
 if not enabled:engine.predict_eads_ml=lambda features:None
 try:geometry=engine.parse_and_generate_3d('smiles',text if kind=='smiles' else isomeric)
 finally:
  SOURCE_MOL=None
  engine.predict_eads_ml=original_predict
 if geometry.get('status')!='SUCCESS':raise ValueError(geometry.get('error_code') or geometry.get('error') or 'RDKIT_3D_FAILED')
 output=Chem.MolFromMolBlock(geometry['mol_block'],removeHs=False)
 if output is None:raise ValueError('INVALID_3D_MOLBLOCK')
 output_key=Chem.MolToInchiKey(Chem.RemoveHs(output))
 if Chem.MolToSmiles(mol,isomericSmiles=False)!=Chem.MolToSmiles(Chem.RemoveHs(output),isomericSmiles=False):raise ValueError('TAUTOMER_OR_CONNECTIVITY_CHANGED_DURING_3D')
 # Unspecified stereochemistry may be assigned during 3D; explicit stereo must match.
 explicit=any(s!='?' for _,s in Chem.FindMolChiralCenters(mol,includeUnassigned=True)) or '/' in isomeric or '\\' in isomeric
 if key.split('-')[0]!=output_key.split('-')[0] or (explicit and key!=output_key):raise ValueError('2D_3D_IDENTITY_MISMATCH')
 atoms=geometry.get('atoms',[]);energy=geometry.get('conformer_energy')
 if len(atoms)!=Chem.AddHs(mol).GetNumAtoms() or not all(math.isfinite(float(a[c])) for a in atoms for c in ('x','y','z')):raise ValueError('INVALID_3D_COORDINATES')
 if energy is None or not math.isfinite(energy) or not output.GetConformer().Is3D():raise ValueError('CONFORMER_OPTIMIZATION_FAILED')
 from rdkit.Chem.Draw import rdMolDraw2D
 drawer=rdMolDraw2D.MolDraw2DSVG(500,300);rdMolDraw2D.PrepareAndDrawMolecule(drawer,mol);drawer.FinishDrawing()
 prediction=predict(mol) if enabled else None
 bridge_descriptors=calculate_bridge_descriptors(mol,output,geometry)
 universal_structure=analyze_universal_structure(mol,analyze_fluorine(mol))
 universal_descriptors=calculate_universal_descriptors(mol,bridge_descriptors,geometry)
 if prediction:prediction.update(bridge_descriptors=bridge_descriptors,universal_structure=universal_structure,universal_descriptors=universal_descriptors)
 geometry.update(universal_structure=universal_structure,universal_descriptors=universal_descriptors,bridge_descriptors=bridge_descriptors,fluorine=analyze_fluorine(mol),ai_prediction=prediction,features=prediction['features'] if prediction else engine.extract_molecular_features(mol),inchikey=key,source_inchikey=key,output_3d_inchikey=output_key,
  canonical_smiles=Chem.MolToSmiles(mol,isomericSmiles=False),isomeric_smiles=isomeric,inchi=Chem.MolToInchi(mol),
  svg_depiction=drawer.GetDrawingText(),identity_verified=True,identity_gate='PASS',prediction_allowed=True,
  input_type=kind,stereo_status='PRESERVED' if key==output_key else 'ASSIGNED_DURING_3D',
  integrity={'formal_charge':Chem.GetFormalCharge(mol),'protonation_state':'AS_INPUT_NOT_NORMALIZED','tautomer_identity':'AS_INPUT_NOT_NORMALIZED',
  'stereochemistry':'EXPLICIT_PRESERVED' if explicit else 'UNSPECIFIED_AS_INPUT','elements':sorted(set(a.GetSymbol() for a in mol.GetAtoms())),
  'applicability_domain':'NOT_ESTABLISHED','unsupported_chemistry':'NOT_ESTABLISHED: no empirical element domain supplied'},
  bonds=[{'begin':b.GetBeginAtomIdx(),'end':b.GetEndAtomIdx(),'order':b.GetBondTypeAsDouble()} for b in output.GetBonds()])
 return geometry

def main():
 action=sys.argv[1] if len(sys.argv)>1 else 'parse'
 if action=='parse':return parse(json.load(sys.stdin))
 if action=='predict':
  # Direct prediction API uses the same verified conformer/B path as material input.
  return parse({'input_type':'smiles','input_data':sys.argv[2]})['ai_prediction']
 if action=='reference_dataset':return engine.REFERENCE_DATASET
 if action=='cas_validate':return dict(zip(('valid','code'),engine.validate_cas(sys.argv[2])))
 if action=='parse_vasp':return engine.parse_vasp_output(json.load(sys.stdin))
 if action=='validate_surface':return engine.validate_surface(sys.stdin.read())
 raise ValueError('UNKNOWN_ACTION')
if __name__=='__main__':
 try:print(json.dumps(main(),ensure_ascii=True,allow_nan=False))
 except Exception as exc:print(json.dumps({'status':'FAILED','status_code':'ENGINE_FAILED','error':str(exc),'error_code':str(exc),'prediction_allowed':False,'is_real_3d':False}))
