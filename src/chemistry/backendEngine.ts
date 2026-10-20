/**
 * Chemistry Engine Orchestrator
 * Coordinates RDKit parsing, identity, descriptors, SMARTS detection,
 * and builds the Immutable Molecular Feature Package.
 */

import { execSync } from 'node:child_process';
import { GoogleGenAI } from '@google/genai';
import initRDKitModule from '@rdkit/rdkit';

import { MolecularIdentity, extractMolecularIdentity } from './molecularIdentity';
import { MolecularDescriptors, calculateMolecularDescriptors } from './molecularDescriptors';
import {
  FunctionalGroupDetectionMap,
  detectFunctionalGroups,
} from './functionalGroupDetection';
import {
  Conformer3DData,
  IdentityGateResult,
  generateConformer3D,
} from './conformerGeneration';
import {
  ImmutableMolecularFeaturePackage,
  createFeaturePackage,
} from './featurePackage';

export * from './molecularIdentity';
export * from './molecularDescriptors';
export * from './functionalGroupDetection';
export * from './conformerGeneration';
export * from './featurePackage';

let rdkitPromise: Promise<any> | null = null;
export async function getRDKit() {
  if (!rdkitPromise) {
    rdkitPromise = (initRDKitModule as any)();
  }
  return rdkitPromise;
}

export interface UnifiedAnalysisResult {
  status: 'SUCCESS' | 'STRUCTURE_RECOGNITION_FAILED' | 'INVALID_INPUT' | 'GATE_FAILED';
  input_type: 'IMAGE' | 'SMILES' | 'InChI' | 'MDL';
  raw_input: string;
  error_message?: string;

  molecular_identity?: MolecularIdentity;
  identity_gate?: IdentityGateResult;
  conformer_3d?: Conformer3DData;
  descriptors?: MolecularDescriptors;
  functional_groups?: FunctionalGroupDetectionMap;
  svg_depiction?: string;
  feature_package?: ImmutableMolecularFeaturePackage;
}

export interface SdfMoleculeOption {
  index: number;
  title: string;
  formula: string;
  molecular_weight: number;
  canonical_smiles: string;
  mol_block: string;
}

/**
 * Parses multi-molecule SDF file or text into individual molecule options.
 */
export async function parseSdfMolecules(sdfText: string): Promise<SdfMoleculeOption[]> {
  const RDKit = await getRDKit();
  const rawBlocks = sdfText.split(/\$\$\$\$/g).map((b) => b.trim()).filter((b) => b.length > 0);
  const options: SdfMoleculeOption[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    try {
      const mol = RDKit.get_mol(block);
      if (mol && mol.is_valid()) {
        const lines = block.split('\n');
        const title = lines[0].trim() || `Molecule ${i + 1}`;
        const smiles = mol.get_smiles();
        const inchi = mol.get_inchi();
        let formula = '';
        const fMatch = inchi.match(/InChI=1S\/([A-Za-z0-9]+)/);
        if (fMatch) formula = fMatch[1];

        const descJson = JSON.parse(mol.get_descriptors() || '{}');
        const mw = Number((descJson.amw || descJson.exactmw || 0).toFixed(2));

        options.push({
          index: i,
          title,
          formula: formula || 'Unknown',
          molecular_weight: mw,
          canonical_smiles: smiles,
          mol_block: block,
        });
        mol.delete();
      }
    } catch {
      // ignore
    }
  }

  return options;
}

/**
 * Chemical Structure Recognition from Image using Gemini Multimodal
 */
export async function recognizeStructureFromImage(
  imageBase64: string,
  mimeType: string
): Promise<{
  success: boolean;
  candidate_smiles?: string;
  formula?: string;
  molecular_weight?: number;
  inchikey?: string;
  svg_depiction?: string;
  error?: string;
}> {
  try {
    const ai = new GoogleGenAI();
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/png',
                data: cleanBase64,
              },
            },
            {
              text: `You are a high-precision chemical optical structure recognition (OCSR) engine.
Identify the 2D chemical structure in this image.
Output ONLY the valid canonical SMILES string for this exact molecule.
Do NOT include markdown formatting, backticks, commentary, chemical names, or explanations.
If the image does not clearly contain a recognizable, unambiguous chemical molecule structure, output exactly "UNRECOGNIZED".`,
            },
          ],
        },
      ],
    });

    const rawText = response.text ? response.text.trim() : '';
    const smiles = rawText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

    if (!smiles || smiles.toUpperCase() === 'UNRECOGNIZED' || smiles.includes(' ')) {
      return {
        success: false,
        error: 'STRUCTURE_RECOGNITION_FAILED: Image did not resolve to a verifiable chemical graph.',
      };
    }

    const RDKit = await getRDKit();
    const mol = RDKit.get_mol(smiles);
    if (!mol || !mol.is_valid()) {
      return {
        success: false,
        error: 'STRUCTURE_RECOGNITION_FAILED: Candidate SMILES failed RDKit chemical graph validation.',
      };
    }

    const canonical_smiles = mol.get_smiles();
    const inchi = mol.get_inchi();
    const inchikey = RDKit.get_inchikey_for_inchi(inchi);
    const descJson = JSON.parse(mol.get_descriptors() || '{}');
    const molecular_weight = Number((descJson.amw || descJson.exactmw || 0).toFixed(2));

    let formula = '';
    const fMatch = inchi.match(/InChI=1S\/([A-Za-z0-9]+)/);
    if (fMatch) formula = fMatch[1];

    let svg_depiction = '';
    try {
      svg_depiction = mol.get_svg(320, 220);
    } catch {
      svg_depiction = '';
    }

    mol.delete();

    return {
      success: true,
      candidate_smiles: canonical_smiles,
      formula: formula || 'Unknown',
      molecular_weight,
      inchikey,
      svg_depiction,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `STRUCTURE_RECOGNITION_FAILED: ${err.message || 'Vision API error'}`,
    };
  }
}

/**
 * Parses InChI via obabel CLI preserving all layers and stereo (+, -, /, =).
 */
export function inchiToSmiles(rawInchi: string): string {
  const trimmed = rawInchi.trim();
  const cmd = `obabel -iinchi -:"${trimmed}" -osmi`;
  const output = execSync(cmd, { encoding: 'utf-8' });
  const smiles = output.split('\t')[0].trim();
  if (!smiles) {
    throw new Error('obabel failed to convert InChI to SMILES');
  }
  return smiles;
}

/**
 * Unified Molecular Pipeline (Section 02)
 * Produces the Immutable Molecular Feature Package.
 */
export async function processChemicalInput(
  inputType: 'IMAGE' | 'SMILES' | 'InChI' | 'MDL',
  payload: {
    raw_text?: string;
    image_base64?: string;
    mime_type?: string;
    candidate_confirmed?: boolean;
    candidate_smiles?: string;
    selected_mol_block?: string;
  }
): Promise<UnifiedAnalysisResult> {
  const RDKit = await getRDKit();
  let mol: any = null;
  let rawInputString = '';

  try {
    if (inputType === 'IMAGE') {
      if (payload.candidate_confirmed && payload.candidate_smiles) {
        rawInputString = payload.candidate_smiles;
        mol = RDKit.get_mol(payload.candidate_smiles);
        if (!mol || !mol.is_valid()) {
          return {
            status: 'STRUCTURE_RECOGNITION_FAILED',
            input_type: 'IMAGE',
            raw_input: payload.candidate_smiles,
            error_message: 'STRUCTURE_RECOGNITION_FAILED: Confirmed structure is invalid in RDKit.',
          };
        }
      } else {
        if (!payload.image_base64) {
          return {
            status: 'STRUCTURE_RECOGNITION_FAILED',
            input_type: 'IMAGE',
            raw_input: '[EMPTY_IMAGE]',
            error_message: 'No image data provided',
          };
        }
        rawInputString = '[IMAGE_DATA]';
        const ocrResult = await recognizeStructureFromImage(
          payload.image_base64,
          payload.mime_type || 'image/png'
        );

        if (!ocrResult.success || !ocrResult.candidate_smiles) {
          return {
            status: 'STRUCTURE_RECOGNITION_FAILED',
            input_type: 'IMAGE',
            raw_input: rawInputString,
            error_message: ocrResult.error || 'STRUCTURE_RECOGNITION_FAILED',
          };
        }

        mol = RDKit.get_mol(ocrResult.candidate_smiles);
        if (!mol || !mol.is_valid()) {
          return {
            status: 'STRUCTURE_RECOGNITION_FAILED',
            input_type: 'IMAGE',
            raw_input: ocrResult.candidate_smiles,
            error_message: 'STRUCTURE_RECOGNITION_FAILED: Candidate SMILES failed RDKit sanitization.',
          };
        }
      }
    } else if (inputType === 'SMILES') {
      rawInputString = (payload.raw_text || '').trim();
      if (!rawInputString) {
        return { status: 'INVALID_INPUT', input_type: 'SMILES', raw_input: '', error_message: 'Empty SMILES input' };
      }
      mol = RDKit.get_mol(rawInputString);
      if (!mol || !mol.is_valid()) {
        return { status: 'INVALID_INPUT', input_type: 'SMILES', raw_input: rawInputString, error_message: 'Invalid SMILES or failed RDKit sanitization.' };
      }
    } else if (inputType === 'InChI') {
      rawInputString = (payload.raw_text || '').trim();
      if (!rawInputString || !rawInputString.startsWith('InChI=')) {
        return { status: 'INVALID_INPUT', input_type: 'InChI', raw_input: rawInputString, error_message: 'Input must be a valid InChI string starting with InChI=' };
      }
      try {
        const convertedSmiles = inchiToSmiles(rawInputString);
        mol = RDKit.get_mol(convertedSmiles);
        if (!mol || !mol.is_valid()) {
          return { status: 'INVALID_INPUT', input_type: 'InChI', raw_input: rawInputString, error_message: 'Failed to sanitize molecule generated from InChI.' };
        }
      } catch (err: any) {
        return { status: 'INVALID_INPUT', input_type: 'InChI', raw_input: rawInputString, error_message: `InChI parsing failed: ${err.message}` };
      }
    } else if (inputType === 'MDL') {
      rawInputString = (payload.selected_mol_block || payload.raw_text || '').trim();
      if (!rawInputString) {
        return { status: 'INVALID_INPUT', input_type: 'MDL', raw_input: '', error_message: 'Empty MDL / SDF block' };
      }

      if (rawInputString.includes('$$$$') && !payload.selected_mol_block) {
        const firstBlock = rawInputString.split('$$$$')[0].trim();
        mol = RDKit.get_mol(firstBlock);
      } else {
        mol = RDKit.get_mol(rawInputString);
      }

      if (!mol || !mol.is_valid()) {
        return { status: 'INVALID_INPUT', input_type: 'MDL', raw_input: rawInputString.slice(0, 100), error_message: 'Invalid MDL MolBlock or failed sanitization.' };
      }
    } else {
      return { status: 'INVALID_INPUT', input_type: inputType, raw_input: '', error_message: 'Unsupported input format' };
    }

    // 1. Molecular Identity
    const molecular_identity = extractMolecularIdentity(mol, rawInputString, RDKit);

    // 2. 3D Conformer & Gate
    const { conformer_3d, identity_gate } = generateConformer3D(
      mol,
      molecular_identity.canonical_smiles,
      rawInputString
    );

    // 3. Molecular Descriptors (15 features)
    const descriptors = calculateMolecularDescriptors(
      mol,
      molecular_identity.molecular_weight,
      molecular_identity.formal_charge
    );

    // 4. Functional Groups (SMARTS topological detection)
    const functional_groups = detectFunctionalGroups(mol, RDKit);

    // 5. 2D SVG
    let svg_depiction = '';
    try {
      svg_depiction = mol.get_svg(320, 220);
    } catch {
      svg_depiction = '';
    }

    // 6. Build Immutable Molecular Feature Package
    const feature_package = createFeaturePackage(
      molecular_identity,
      descriptors,
      functional_groups,
      conformer_3d,
      identity_gate,
      svg_depiction
    );

    mol.delete();

    return {
      status: 'SUCCESS',
      input_type: inputType,
      raw_input: rawInputString,
      molecular_identity,
      identity_gate,
      conformer_3d,
      descriptors,
      functional_groups,
      svg_depiction,
      feature_package,
    };
  } catch (err: any) {
    return {
      status: 'INVALID_INPUT',
      input_type: inputType,
      raw_input: rawInputString,
      error_message: err.message || 'Error processing chemical structure',
    };
  }
}
