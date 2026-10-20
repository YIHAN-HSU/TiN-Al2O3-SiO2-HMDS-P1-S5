"""Additive P1-G descriptor view; the original P1-F B output remains unchanged."""
from rdkit import rdBase
from rdkit.Chem import rdMolDescriptors

def calculate_universal_descriptors(mol,base,geometry=None):
    physical=dict(base['physical'])
    physical.update(fraction_csp3=rdMolDescriptors.CalcFractionCSP3(mol),aromatic_ring_count=rdMolDescriptors.CalcNumAromaticRings(mol))
    conformer=dict(base['conformer'])
    sha=conformer.get('conformer_sha256')
    conformer.update(conformer_id='RDKIT-SHA256-'+sha if sha else None,id_kind='EXPORTED_CONFORMER_CONTENT_HASH',
                     optimization_method=conformer.get('engine'),conformer_energy=conformer.get('energy_kcal_mol'),energy_unit='kcal/mol',
                     optimization_status=(geometry or {}).get('conformer_status','NOT_CALCULATED'),
                     minimizer_convergence='NOT_RECORDED_BY_ORIGINAL_ENGINE',native_conformer_index=None)
    electronic={k:dict(v) for k,v in base['electronic'].items()}
    electronic['local_electronic_descriptors']=dict(status='NOT_CALCULATED',value=None,method=None,backend=None,backend_version=None,unit='METHOD_DEPENDENT',reference_dataset=None,
                                                 reason='No traceable quantum calculation or independently validated predictor configured.',source_inchikey=base['source_inchikey'])
    return dict(base,descriptor_id='P1G_UNIVERSAL_B',descriptor_version='1.0.0',rdkit_version=rdBase.rdkitVersion,
                base_descriptor_id=base['descriptor_id'],base_descriptor_version=base['descriptor_version'],physical=physical,conformer=conformer,electronic=electronic,
                units=dict(base['units'],fraction_csp3='fraction of carbon atoms with sp3 hybridization',aromatic_ring_count='count'))
