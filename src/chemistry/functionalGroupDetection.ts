/**
 * SMARTS-Based Functional Group Detection Module
 * Topological SMARTS substructure pattern matching on verified RDKit Mol.
 * Functional groups: OH, COOH, ESTER, ETHER, AMINE, AMIDE, NITRILE, CARBONYL, AROMATIC, C=C.
 */

export interface FunctionalGroupData {
  count: number;
  label: string;
  smarts: string;
  matchedAtoms?: number[][];
}

export type FunctionalGroupDetectionMap = Record<string, FunctionalGroupData>;

export const STANDARD_FUNCTIONAL_GROUP_PATTERNS: Record<
  string,
  { label: string; smartsPatterns: string[] }
> = {
  OH: {
    label: 'Alcohol / Phenol OH',
    smartsPatterns: ['[OX2H1][CX4]', '[OX2H1][c]'],
  },
  COOH: {
    label: 'Carboxylic Acid (COOH)',
    smartsPatterns: ['[CX3](=O)[OX2H1]'],
  },
  ester: {
    label: 'Ester',
    smartsPatterns: ['[CX3](=[OX1])[OX2H0][#6]'],
  },
  ether: {
    label: 'Ether',
    smartsPatterns: ['[OD2]([#6;!$(C=O)])[#6;!$(C=O)]'],
  },
  amine: {
    label: 'Amine / N-Donor',
    smartsPatterns: [
      '[NX3;H2;!$(NC=O)]',
      '[NX3;H1;!$(NC=O)]',
      '[NX3;H0;!$(NC=O);!$([n])]',
    ],
  },
  amide: {
    label: 'Amide',
    smartsPatterns: ['[CX3](=[OX1])[NX3]'],
  },
  nitrile: {
    label: 'Nitrile',
    smartsPatterns: ['[CX2]#[NX1]'],
  },
  carbonyl: {
    label: 'Carbonyl (C=O)',
    smartsPatterns: [
      '[CX3;H1](=[OX1])[#6]',
      '[CX3;H0](=[OX1])([#6])[#6]',
      '[CX3;H2]=[OX1]',
    ],
  },
  aromatic_ring: {
    label: 'Aromatic Ring',
    smartsPatterns: ['a1aaaa1', 'a1aaaaa1'],
  },
  alkene_cc: {
    label: 'Alkene (C=C)',
    smartsPatterns: ['[CX3;!a]=[CX3;!a]'],
  },
};

export function detectFunctionalGroups(
  mol: any,
  RDKit: any
): FunctionalGroupDetectionMap {
  const result: FunctionalGroupDetectionMap = {};

  for (const [key, meta] of Object.entries(STANDARD_FUNCTIONAL_GROUP_PATTERNS)) {
    let count = 0;
    const matchedAtoms: number[][] = [];

    for (const pattern of meta.smartsPatterns) {
      try {
        const qmol = RDKit.get_qmol(pattern);
        if (qmol && qmol.is_valid()) {
          const matchesStr = mol.get_substruct_matches(qmol);
          const parsedMatches = JSON.parse(matchesStr || '[]');
          if (Array.isArray(parsedMatches)) {
            count += parsedMatches.length;
            parsedMatches.forEach((m: any) => {
              if (m.atoms) matchedAtoms.push(m.atoms);
            });
          }
          qmol.delete();
        }
      } catch {
        // pattern mismatch or unsupported pattern syntax ignored
      }
    }

    result[key] = {
      count,
      label: meta.label,
      smarts: meta.smartsPatterns.join(', '),
      matchedAtoms,
    };
  }

  return result;
}
