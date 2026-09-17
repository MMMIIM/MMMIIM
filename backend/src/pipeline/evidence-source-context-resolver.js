import { AppError } from '../errors.js';
import { hashSource } from './source-location-resolver.js';

export const EVIDENCE_SOURCE_RESOLVER_VERSION='evidence-source-span-v1';
export const SOURCE_SPAN_MAX_CHARS=4000;
export const EVIDENCE_SOURCE_MAX_CHARS=SOURCE_SPAN_MAX_CHARS;
export const EVIDENCE_SOURCE_MAX_PARAGRAPHS=12;
export const EVIDENCE_SOURCE_STRATEGIES=Object.freeze(['anchor_only','paragraph_reconstruction','heading_group','bounded_paragraph_window']);
const REQUESTED_STRATEGIES=new Set(['auto',...EVIDENCE_SOURCE_STRATEGIES]);
const sha=hashSource;
const byIndex=(a,b)=>a.chunk_index-b.chunk_index;
const heading=(value)=>{const match=/^(#{1,6})\s+(.+)$/m.exec(String(value||'').trim());return match?{level:match[1].length,text:match[2].trim()}:null;};
const paragraphs=(source)=>[...source.matchAll(/\S[\s\S]*?(?=\r?\n\s*\r?\n|$)/g)].map((match,index)=>({index,start:match.index,end:match.index+match[0].length,text:match[0],heading:heading(match[0])}));
const containing=(items,start,end)=>items.find((item)=>item.start<=start&&item.end>=end)||null;
function headingContext(items,paragraphIndex){const path=[];for(let index=0;index<=paragraphIndex;index+=1){const current=items[index].heading;if(!current)continue;while(path.length&&path.at(-1).level>=current.level)path.pop();path.push(current);}return path;}

export class EvidenceSourceContextResolver {
  resolve({material,chunks,anchorChunkId,strategy='auto'}){
    if(!material)throw new AppError('MATERIAL_NOT_FOUND','企业材料不存在。',404);
    if(!REQUESTED_STRATEGIES.has(strategy))throw new AppError('SOURCE_SPAN_BOUNDARY_INVALID','Evidence Source Span 解析策略无效。',422);
    const materialText=typeof material.extracted_text==='string'?material.extracted_text:'';
    const ordered=[...(chunks||[])].filter((item)=>item.material_id===material.id).sort(byIndex);
    const anchor=ordered.find((item)=>item.chunk_id===anchorChunkId);
    if(!anchor)throw new AppError('ANCHOR_CHUNK_NOT_FOUND','Retrieval Anchor Chunk 不存在或不属于指定材料。',404);
    if(!Number.isInteger(anchor.char_start)||!Number.isInteger(anchor.char_end)||anchor.char_start<0||anchor.char_end<=anchor.char_start||anchor.char_end>materialText.length)throw new AppError('ANCHOR_SOURCE_RANGE_INVALID','Anchor Chunk 来源范围无效。',422);
    if(materialText.slice(anchor.char_start,anchor.char_end)!==anchor.source_text)throw new AppError('SOURCE_TEXT_MISMATCH','Anchor Chunk 原文与 Material 来源范围不一致。',409);
    const sameVersion=ordered.filter((item)=>item.chunker_version===anchor.chunker_version);
    const blocks=paragraphs(materialText);const anchorParagraph=containing(blocks,anchor.char_start,anchor.char_end);
    if(!anchorParagraph)throw new AppError('ANCHOR_SOURCE_RANGE_INVALID','Anchor Chunk 无法定位到自然段。',422);
    let requested=strategy,resolved=strategy,fallbackReason=null,range;
    if(strategy==='auto'){
      if(anchor.char_start===anchorParagraph.start&&anchor.char_end===anchorParagraph.end){
        const group=this.headingRange(blocks,anchorParagraph.index);
        if(group&&group.end-group.start<=SOURCE_SPAN_MAX_CHARS){resolved='heading_group';range=group;}
        else{resolved='anchor_only';range={start:anchor.char_start,end:anchor.char_end};}
      }else if(anchorParagraph.end-anchorParagraph.start<=SOURCE_SPAN_MAX_CHARS){resolved='paragraph_reconstruction';range={start:anchorParagraph.start,end:anchorParagraph.end};}
      else{resolved='bounded_paragraph_window';fallbackReason='PARAGRAPH_EXCEEDS_MAX_CHARS';range=this.boundedRange(blocks,anchorParagraph.index,anchor,materialText.length);}
    }else if(strategy==='anchor_only')range={start:anchor.char_start,end:anchor.char_end};
    else if(strategy==='paragraph_reconstruction'){
      if(anchorParagraph.end-anchorParagraph.start<=SOURCE_SPAN_MAX_CHARS)range={start:anchorParagraph.start,end:anchorParagraph.end};
      else{resolved='bounded_paragraph_window';fallbackReason='PARAGRAPH_EXCEEDS_MAX_CHARS';range=this.boundedRange(blocks,anchorParagraph.index,anchor,materialText.length);}
    }else if(strategy==='heading_group'){
      const group=this.headingRange(blocks,anchorParagraph.index);
      if(group&&group.end-group.start<=SOURCE_SPAN_MAX_CHARS)range=group;
      else{resolved='bounded_paragraph_window';fallbackReason=group?'HEADING_GROUP_EXCEEDS_MAX_CHARS':'HEADING_GROUP_NOT_FOUND';range=this.boundedRange(blocks,anchorParagraph.index,anchor,materialText.length);}
    }else range=this.boundedRange(blocks,anchorParagraph.index,anchor,materialText.length);
    const coverageStart=Math.min(...sameVersion.map((item)=>item.char_start));const coverageEnd=Math.max(...sameVersion.map((item)=>item.char_end));
    if(range){range={start:Math.max(range.start,coverageStart),end:Math.min(range.end,coverageEnd)};}
    if(!range||range.start<0||range.end<=range.start||range.end>materialText.length||range.end-range.start>SOURCE_SPAN_MAX_CHARS)throw new AppError('SOURCE_SPAN_BOUNDARY_INVALID','Evidence Source Span 边界无效。',422);
    if(anchor.char_start<range.start||anchor.char_end>range.end)throw new AppError('SOURCE_SPAN_BOUNDARY_INVALID','Evidence Source Span 未包含 Anchor。',422);
    const sourceText=materialText.slice(range.start,range.end);if(!sourceText)throw new AppError('SOURCE_SPAN_EMPTY','Evidence Source Span 不能为空。',422);
    const sourceTextHash=sha(sourceText);if(sha(materialText.slice(range.start,range.end))!==sourceTextHash)throw new AppError('SOURCE_SPAN_HASH_MISMATCH','Evidence Source Span hash 校验失败。',409);
    const included=sameVersion.filter((item)=>item.char_end>range.start&&item.char_start<range.end);
    const path=headingContext(blocks,anchorParagraph.index).map((item)=>item.text);
    const spanId=`ESPAN-${sha([material.project_id,material.id,anchor.chunk_id,EVIDENCE_SOURCE_RESOLVER_VERSION,resolved,range.start,range.end,sourceTextHash].join('|')).slice(0,32).toUpperCase()}`;
    const pageValues=included.flatMap((item)=>[item.page_start,item.page_end]).filter(Number.isInteger);
    const spanBlocks=blocks.filter((item)=>item.start<range.end&&item.end>range.start);
    return{span_id:spanId,project_id:material.project_id,material_id:material.id,source_document_id:material.id,anchor_chunk_id:anchor.chunk_id,requested_strategy:requested,resolver_strategy:resolved,fallback_reason:fallbackReason,start_offset:range.start,end_offset:range.end,source_text:sourceText,source_text_hash:sourceTextHash,heading_path:path,source_chunk_ids:included.map((item)=>item.chunk_id),resolver_version:EVIDENCE_SOURCE_RESOLVER_VERSION,source_hash:sourceTextHash,source_location:{char_start:range.start,char_end:range.end,page_start:pageValues.length?Math.min(...pageValues):null,page_end:pageValues.length?Math.max(...pageValues):null,paragraph_start:spanBlocks[0]?.index+1??anchorParagraph.index+1,paragraph_end:spanBlocks.at(-1)?.index+1??anchorParagraph.index+1,section:path.at(-1)||anchor.section||null,heading_path:path,anchor_chunk_id:anchor.chunk_id,source_chunk_ids:included.map((item)=>item.chunk_id),resolution_method:resolved,requested_strategy:requested,fallback_reason:fallbackReason,resolver_version:EVIDENCE_SOURCE_RESOLVER_VERSION}};
  }

  headingRange(blocks,anchorIndex){let start=-1,level=null;for(let index=anchorIndex;index>=0;index-=1)if(blocks[index].heading){start=index;level=blocks[index].heading.level;break;}if(start<0)return null;let end=blocks.at(-1).end;for(let index=start+1;index<blocks.length;index+=1)if(blocks[index].heading&&blocks[index].heading.level<=level){end=blocks[index].start;break;}return{start:blocks[start].start,end};}

  boundedRange(blocks,anchorIndex,anchor,sourceLength){let start=anchorIndex,end=anchorIndex;const activeHeading=headingContext(blocks,anchorIndex).at(-1);while(start>0&&anchor.char_end-blocks[start-1].start<=SOURCE_SPAN_MAX_CHARS&&anchorIndex-start<EVIDENCE_SOURCE_MAX_PARAGRAPHS/2){if(activeHeading&&blocks[start-1].heading&&blocks[start-1].heading.level<=activeHeading.level)break;start-=1;}while(end+1<blocks.length&&blocks[end+1].end-blocks[start].start<=SOURCE_SPAN_MAX_CHARS&&end-start+1<EVIDENCE_SOURCE_MAX_PARAGRAPHS){if(blocks[end+1].heading)break;end+=1;}let range={start:blocks[start].start,end:blocks[end].end};if(range.end-range.start>SOURCE_SPAN_MAX_CHARS){const rangeStart=Math.max(0,Math.min(anchor.char_start,anchor.char_end-SOURCE_SPAN_MAX_CHARS));range={start:rangeStart,end:Math.min(sourceLength,rangeStart+SOURCE_SPAN_MAX_CHARS)};}return range;}
}
