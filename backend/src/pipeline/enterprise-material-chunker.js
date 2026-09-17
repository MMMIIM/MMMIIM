import { createHash } from 'node:crypto';

export const ENTERPRISE_MATERIAL_CHUNKER_VERSION='enterprise-material-v1';
export const CHUNK_QUALITY_GATE_VERSION='chunk-quality-gate-v1';
const MAX_CHARS=1200;

const sha=(value)=>createHash('sha256').update(value).digest('hex');

const structuralLine=(value)=>/^#{1,6}\s+\S.*$/u.test(value)||/^[-*•]\s*$/u.test(value)||/^-{3,}$/u.test(value);

/**
 * Additive, deterministic chunk-quality metadata. The current database
 * schema remains unchanged; retrieval may use this metadata as a gate while
 * preserving the original chunk text and identity.
 */
export function classifyEnterpriseChunkQuality(sourceText, { parentSectionId=null, headingPath=[] }={}) {
  const source=String(sourceText ?? '');
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const structuralOnly=!lines.length||lines.every(structuralLine);
  return {
    chunk_role: structuralOnly?'STRUCTURAL_ONLY':'SUBSTANTIVE_TEXT',
    parent_section_id: parentSectionId,
    heading_path: Array.isArray(headingPath)?[...headingPath]:[],
    content_length: source.length,
    content_hash: sha(source),
    chunk_quality_gate_version: CHUNK_QUALITY_GATE_VERSION
  };
}

export function chunkEnterpriseMaterial(materialId, extractedText, { maxChars=MAX_CHARS, chunkerVersion=ENTERPRISE_MATERIAL_CHUNKER_VERSION }={}) {
  const source=String(extractedText ?? '');
  const segments=[];
  const matches=[...source.matchAll(/\S[\s\S]*?(?=\r?\n\s*\r?\n|$)/g)];
  for(let paragraph=0;paragraph<matches.length;paragraph+=1){
    const raw=matches[paragraph][0]; const base=matches[paragraph].index;
    for(let offset=0;offset<raw.length;offset+=maxChars){
      const text=raw.slice(offset,offset+maxChars); if(!text.trim())continue;
      segments.push({source_text:text,char_start:base+offset,char_end:base+offset+text.length,paragraph_start:paragraph+1,paragraph_end:paragraph+1});
    }
  }
  return segments.map((item,chunkIndex)=>{
    const chunkHash=sha(item.source_text);
    const quality=classifyEnterpriseChunkQuality(item.source_text);
    return {chunk_id:`MCH-${sha(`${materialId}|${chunkerVersion}|${chunkIndex}|${item.char_start}|${item.char_end}|${chunkHash}`).slice(0,32).toUpperCase()}`,material_id:materialId,chunk_index:chunkIndex,...item,page_start:null,page_end:null,section:null,chunk_hash:chunkHash,chunker_version:chunkerVersion,...quality,content_hash:chunkHash};
  });
}
