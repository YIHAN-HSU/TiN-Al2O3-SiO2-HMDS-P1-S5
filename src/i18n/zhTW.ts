export const surfaceName=(id:string)=>({TiN:'TiN',Al2O3:'Al₂O₃（羥基化）',SiO2:'SiO₂（羥基化）',HMDS_SiO2:'HMDS 改質 SiO₂'} as Record<string,string>)[id]||id;
const states:Record<string,string>={ORIGINAL:'沿用原始模型表面假設',ORIGINAL_TIN_SCREENING_SURFACE:'原始 TiN 模型表面（樣品氧化狀態未確認）',HYDROXYLATED:'羥基化',HYDROXYLATED_SIO2:'羥基化 SiO₂',HYDROXYLATED_ALPHA_AL2O3_0001:'羥基化 α-Al₂O₃(0001)',DEFINED_COVERAGE:'TMS 端基改質（覆蓋率未量測）',TMS_TERMINATED_SIO2:'TMS 端基改質 SiO₂',DRY_RESEARCH:'舊版乾燥表面研究紀錄',DEHYDROXYLATED:'去羥基化（舊版研究狀態）'};
export const surfaceState=(s:string)=>states[s]||s;
const statuses:Record<string,string>={AUTOMATIC:'自動選擇模型',SCIENTIFIC_PREDICTION:'原有科學模型紀錄',HYPOTHETICAL_SIMULATION:'假設性情境計算',HYPOTHETICAL_SCORE:'假設性吸附分數',EADS:'Eads 吸附能篩選值',DELTA_G_ADSORPTION:'ΔGads 吸附自由能',LOW:'低',MEDIUM:'中',HIGH:'高',INSUFFICIENT_INFORMATION:'資料不足，無法判定',UNKNOWN:'未知',ASSUMED:'假設',MEASURED:'實測',STRUCTURE_ONLY:'結構初步推測',FORMULATION_PROCESS:'配方／製程輔助判定',STRUCTURE_ONLY_HYPOTHETICAL_SCREENING:'僅依結構的假設性初步篩選',PROCESS_INPUTS_WITH_UNVALIDATED_MECHANISM_SCREENING:'含配方／製程資訊的未驗證機制篩選',NOT_VALIDATED:'尚未完成實驗驗證',NOT_PHYSICAL_DELTA_G:'非物理吸附自由能',NOT_CALIBRATED:'尚未校正',NOT_QUANTITATIVELY_CALIBRATED:'尚未完成定量校正',NOT_ESTABLISHED:'尚未建立',OUT_OF_DOMAIN:'超出適用範圍',IN_DOMAIN:'位於適用範圍內',NOT_AVAILABLE:'無可用結果',NOT_CALCULATED:'尚未計算',NOT_APPLICABLE:'不適用',NOT_SELECTED:'未勾選',EXISTING_SCREENING_MODEL:'既有篩選模型',EXISTING_MODEL:'既有篩選模型','EXISTING_V1.2_SCREENING_MODEL':'既有 v1.2 篩選模型（非新執行 DFT）',EXPLORATORY_ORIGINAL_MODEL:'原始探索性篩選模型',MODEL_NOT_VALIDATED:'模型尚未驗證',QUANTITATIVE_PREDICTION_NOT_READY:'尚無適用的定量預測模型',MEDIUM_ASSUMPTION_SENSITIVITY:'中度假設敏感度',HIGH_ASSUMPTION_SENSITIVITY:'高度假設敏感度',LOW_ASSUMPTION_SENSITIVITY:'低度假設敏感度',SUCCESS:'成功',FAILED:'失敗',PASS:'通過',FAIL:'未通過',CALCULATED:'已計算',OPTIMIZED_3D:'已完成 3D 最佳化',NOT_RECORDED_BY_ORIGINAL_ENGINE:'原始引擎未記錄',MODEL_UNAVAILABLE:'模型無可用結果',INCOMPATIBLE_ENERGY_DEFINITIONS:'能量定義不相容，無法定量比較',INDEPENDENTLY_VALIDATED:'已通過獨立驗證',MECHANISTIC_HYPOTHESIS_NOT_VALIDATED_FOR_THIS_FORMULATION:'機制假說，尚未對此配方驗證',DEWETTING:'局部露底／縮孔',UNIFORMITY:'膜厚均勻度'};
export const statusZh=(s:any):string=>s==null?'未提供':statuses[String(s)]||String(s);
const missing:Record<string,string>={ENVIRONMENT:'環境',TEMPERATURE_K:'溫度',STANDARD_STATE:'標準態',SURFACE_MODEL_ID:'表面模型',MORPHOLOGY:'表面形貌',FACET:'晶面',TERMINATION:'端基',SILANOL_DENSITY_NM2:'矽醇密度',HYDRATION:'含水狀態',TMS_COVERAGE_NM2:'TMS 覆蓋率',RESIDUAL_OH_NM2:'殘餘羥基密度',POLARITY_DEFINITION:'表面極性定義',CONTACT_ACCESSIBILITY:'接觸可接近性',STERIC_DEFINITION:'立體效應定義'};
export function reasonZh(value:any):string{
 const s=String(value??'');if(!s)return '未提供補充說明。';if(statuses[s])return statuses[s];
 if(s.includes('POOR_CO_SELECT_AT_LEAST_ONE'))return '請至少勾選一項塗佈不良評估：局部露底／縮孔或膜厚均勻度。';
 if(s.includes('EMPTY_INPUT')||s.includes('Cannot submit empty'))return '請先輸入有效的 SMILES、InChI 或 MDL 分子結構。';
 if(/SMILES_PARSING|SYNTAX|INVALID_SMILES|PARSE_ERROR|RDKIT_FAILED|MOLECULAR_ANALYSIS_FAILED|SANITIZATION|Invalid SMILES/i.test(s))return '無法解析分子結構，請檢查原子價數、括號、環閉合、立體標記與輸入格式；未產生預測值。';
 if(s.includes('SELECT_ONE_TO_FOUR'))return '請至少勾選一種底材，且不可重複選取。';
 if(s.includes('VALUE_AND_SOURCE_REQUIRED'))return '已標示為實測或假設的欄位，需填寫數值及來源／假設依據。';
 if(s.includes('POOR_CO_INVALID_RANGE')||s.includes('UNCERTAINTY'))return '配方／製程數值或不確定度超出允許範圍，請檢查單位及欄位。';
 if(s.includes('POOR_CO_REQUIRES_HYDROXYLATED'))return '塗佈不良評估使用固定的羥基化 SiO₂ 表面。';
 if(s.includes('UNSUPPORTED_CHEMISTRY')||s.includes('NEUTRAL_CLOSED_SHELL'))return '此結構超出既有假設引擎的適用範圍（需為支援元素的單一中性閉殼層有機分子）；未提供 SU 分數。';
 if(s.includes('HEAVY_ATOM_RESOURCE_LIMIT'))return '分子大小超出目前引擎的資源限制，未提供假設分數。';
 if(s.includes('3D_IDENTITY_OR_COORDINATE_GATE_FAILED'))return '3D 結構未通過身分或座標檢查；保留原始分子，不使用無法確認的形狀描述符。';
 if(s.includes('No independently validated applicable bridge'))return '沒有適用且通過獨立驗證的校正模型，未套用校正值。';
 if(s.includes('scenario score has no independent raw'))return '假設性分數沒有獨立的原始吸附能或參考能量，原始科學資料保留於詳情。';
 if(s.includes('No calibrated bridge is applied'))return '假設性分數未套用經驗證的校正層。';
 if(s.includes('No independently calibrated numerical error'))return '尚無經獨立校正的數值誤差估計。';
 if(s.includes('sampled parameter envelope')||s.includes('sampled assumption range'))return '顯示的是假設參數取樣範圍，不是統計誤差或信賴區間。';
 if(s.includes('Physical ΔΔG is reported only'))return '物理 ΔΔG 僅於兩種表面均有相容的自由能結果時提供；不混減 Eads 與 ΔGads。';
 if(s.includes('Scenario Difference is reported'))return '情境差值顯示於 HMDS 列，定義為 HMDS − SiO₂（SU）。';
 if(s.includes('Both selected surfaces need finite scores'))return '需同時勾選 SiO₂ 與 HMDS，且兩者皆有同一情境的有效 SU 分數。';
 if(s.includes('No saved scenario score'))return '尚無此分子及設定的假設分數，請按「開始分析」。';
 if(s.includes('MISSING_'))return s.split(/;\s*/).map(x=>x.startsWith('MISSING_')?'缺少'+(missing[x.slice(8)]||'必要條件'):reasonZh(x)).join('；');
 if(s.includes('No independently validated formulation')||s.includes('No calibrated spin'))return '尚未建立可將此配方、表面與製程連結至實際缺陷的獨立驗證模型，因此正式風險為資料不足。';
 if(s.includes('Standard InChI may normalize'))return '標準 InChI 可能正規化質子或互變異構位置；不能只靠 InChIKey 判定明確分子圖與逐原子形式電荷完全相同。';
 if(/Request error|Network error|Failed to fetch/i.test(s))return '無法連線至本機服務，請確認服務已啟動後再試。';
 if(/[\u3400-\u9fff]/.test(s))return s;
 return '此項仍缺少相容資料、已驗證模型或必要計算條件；請展開原始資料查看技術代碼。';
}
const groupNames:Record<string,string>={MW:'分子量',LogP:'LogP（估計）',TPSA:'TPSA',HBD:'氫鍵供體',HBA:'氫鍵受體',Rotatable_Bonds:'可旋轉鍵',RB:'可旋轉鍵',Aromatic_Rings:'芳香環',Ring_Count:'環數',Alcohol:'醇',Phenol:'酚',Ether:'醚',Ester:'酯',Carbonyl:'羰基',Amide:'醯胺',Amine:'胺',Carboxylic_Acid:'羧酸',Carboxylate:'羧酸根',Acrylate:'丙烯酸酯',Methacrylate:'甲基丙烯酸酯',Vinyl_Ether:'乙烯基醚',EO_Unit:'EO 鏈單元',Benzene:'苯環',Norbornene:'降冰片烯',F_Atom:'氟原子',CF:'CF',CF2:'CF₂',CF3:'CF₃',Aromatic_F:'芳香族 C–F',Aromatic_CF3:'芳香族 CF₃',Alicyclic_Rings:'脂環',Fused_Aromatic_Systems:'稠合芳香環系統'};
export const featureZh=(s:string)=>groupNames[s]||s;
import catalog from './uiCatalog.json';
const narrative:Record<string,string>={
'MODERATE':'中等','STRONG':'強','WEAK':'弱','VERY_STRONG':'很強','QUALITATIVE ANCHORS':'定性機制依據','NOT ESTABLISHED':'尚未建立','NOT CALCULATED':'尚未計算','NOT EXPLICITLY MODELED':'未明確建模','PENDING_VERIFICATION':'待原文核對','PARTIAL':'部分涵蓋','NONE':'無','VERY_HIGH':'很高',
'EXPLORATORY SCREENING ESTIMATE: Parameters (-0.14 eV intercept, -0.01667 eV/score slope) are UNCALIBRATED HEURISTIC PARAMETERS and are NOT fitted to TiN DFT literature. Not a converged DFT adsorption energy nor a validated ML model.':'探索性篩選估計：截距 −0.14 eV 與斜率 −0.01667 eV／分數為未校正啟發式參數，未以 TiN DFT 文獻擬合；不代表收斂的 DFT 吸附能或經驗證的機器學習模型。',
'EXPLORATORY. NOT QUANTITATIVELY CALIBRATED. Original reference entries do not establish validation.':'探索性結果，尚未完成定量校正；原始參考紀錄不代表模型已驗證。',
'Empirical applicability and uncertainty are NOT_ESTABLISHED. No DFT was executed.':'經驗適用範圍與不確定度尚未建立；未執行 DFT。',
'Size & Dispersion':'尺寸與分散作用','Polar Coupling':'極性耦合','H-Bonding Network':'氫鍵網絡','Oxygen Interaction Potential':'含氧結構作用指標','Nitrogen Interaction Potential':'含氮結構作用指標','Aromatic & Alkene Pi-Dispersion':'芳香環與烯鍵 π 分散作用',
'Molecular contact area on oxidized TiN interface':'原始模型中的分子接觸面積代理指標（沿用原始表面假設）',
'TPSA interaction with surface Ti-O/Ti-OH dipoles':'TPSA 與模型假設的 Ti–O／Ti–OH 偶極作用',
'HBD and HBA interaction with surface oxygens and Ti centers':'氫鍵供體與受體對表面氧及 Ti 中心的作用指標',
'OH and Carbonyl qualitative anchors + model-estimated O groups':'OH 與羰基定性依據，加上模型估計的其他含氧官能基',
'Amine / N-donor Lewis coordination qualitative anchor + amides/nitriles':'胺與含氮供體的路易士配位定性依據，以及醯胺／腈指標',
'Planar ring and pi-electron dispersion':'平面環與 π 電子分散作用指標'};
Object.assign(statuses,narrative);
Object.assign(groupNames,{OH:'羥基',COOH:'羧酸',Carbonyl:'羰基',ether:'醚',ester:'酯',alcohol:'醇',phenol:'酚',carboxylic_acid:'羧酸',amide:'醯胺',amine:'胺',nitrile:'腈',aromatic_ring:'芳香環',Aromatic:'芳香結構',Alkene:'烯鍵',Nitrile:'腈',Heavy_Atoms:'重原子數',FractionCSP3:'sp³ 碳比例',Max_Carbon_Chain:'最長碳鏈'});
/** Display translation only. Source models, enums and raw technical data are retained. */
export const uiText=(v:any):string=>{const s=String(v??'');return narrative[s]||(catalog as Record<string,string>)[s]||statuses[s]||groupNames[s]||reasonZh(s);};
Object.assign(statuses,{ACHIRAL_UNSPECIFIED:'未指定立體中心或無手性',ACHIRAL:'無手性',CHIRAL_SPECIFIED:'已指定立體化學',STEREOCHEMISTRY_PRESERVED:'立體化學已保留',INCONCLUSIVE:'尚無定量結論','NO VERIFIED EADS':'無已核實 Eads','NO_VERIFIED_EADS':'無已核實 Eads','QUALITATIVE LITERATURE SUPPORT':'定性文獻支持','MODEL-ESTIMATED':'模型估計'});
Object.assign(groupNames,{carbonyl:'羰基',alkene_cc:'碳碳雙鍵','Alcohol / Phenol OH':'醇／酚羥基',aromatic:'芳香結構',Aromatic:'芳香結構',Carbonyl:'羰基'});

Object.assign(narrative,{
'RDKit connectivity graph verified. Heavy atom and bond topology match molecular authority.':'RDKit 連接圖已核對；重原子與鍵結拓樸符合權威分子圖。',
'No internally consistent organic alcohol quantitative Eads dataset on oxidized TiN.':'尚無表面條件與定義一致的有機醇／氧化 TiN 定量 Eads 資料集。',
'Lacks quantitative DFT benchmark on oxidized/hydroxylated TiN surfaces.':'缺少氧化／羥基化 TiN 表面的定量 DFT 基準。',
'No verified quantitative literature Eads.':'尚無已核實的定量文獻 Eads。',
'Inorganic NH3 cannot be treated as verified quantitative labels for organic amines.':'無機 NH₃ 的結果不能當成有機胺的已驗證定量標籤。'
});

Object.assign(groupNames,{Bridgeheads:'橋頭原子',Carbon_Atoms:'碳原子數',Double_Bonds:'雙鍵數',CC_Double_Bonds:'碳碳雙鍵數',Small_Rings:'小環數',Total_Formal_Charge:'總形式電荷',Has_Formal_Charge:'具有形式電荷',Ring_Count:'環數',Max_Ring_Size:'最大環尺寸',EO_Units:'EO 鏈單元',Fused_Rings:'稠合環',Bridged_Rings:'橋環',CF_Count:'CF 數量'});
