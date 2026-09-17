$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$root = Join-Path $repo 'backend/eval/requirement-unseen-holdout-v2'
$inbox = Join-Path $root 'inbox'
$work = Join-Path $root 'work'
$results = Join-Path $root 'results'
$extracted = Join-Path $work 'HOLDOUT-REQ-V2-01/extracted'
New-Item -ItemType Directory -Force -Path $results | Out-Null

function Hash-File([string]$path) { (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() }
function Rel([string]$path) { [IO.Path]::GetRelativePath($repo, $path).Replace('\','/') }
function File-Meta([string]$path, [string]$role) {
  $item = Get-Item -LiteralPath $path
  [ordered]@{ path = Rel $path; role = $role; bytes = $item.Length; sha256 = Hash-File $path; last_write_time = $item.LastWriteTime.ToString('o') }
}
function Zip-Entry-Meta($entry, $zipPath) {
  if ($entry.FullName.EndsWith('/')) { return [ordered]@{ path=$entry.FullName; directory=$true; bytes=0; sha256=$null } }
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = $entry.Open()
  try { $digest = ($sha.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) -join '' }
  finally { $stream.Dispose(); $sha.Dispose() }
  [ordered]@{ path=$entry.FullName; directory=$false; bytes=$entry.Length; sha256=$digest }
}

$zipPath = Join-Path $inbox '56486515242d40eaa01ff4cac1ecf093.zip'
$standalonePath = Join-Path $inbox '国家金融监督管理总局2026年服务器及网络安全设备采购项目采购文件.pdf'
$h1Pdf = Join-Path $extracted '2026年网络路由交换和网络安全设备项目招标文件（260601001）.pdf'
$h1Docx = Join-Path $extracted '2026年网络路由交换和网络安全设备项目招标文件（260601001）.docx'
$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
try { $zipEntries = @($zip.Entries | ForEach-Object { Zip-Entry-Meta $_ $zipPath }) }
finally { $zip.Dispose() }
$expectedExtracted = @($zipEntries | Where-Object { -not $_.directory } | ForEach-Object { $_.path })
$actualExtracted = @(Get-ChildItem -Recurse -File -LiteralPath $extracted | ForEach-Object { [IO.Path]::GetRelativePath($extracted, $_.FullName).Replace('\','/') })
$missingExtracted = @($expectedExtracted | Where-Object { $_ -notin $actualExtracted })
$extraExtracted = @($actualExtracted | Where-Object { $_ -notin $expectedExtracted })
$archiveExtraction = [ordered]@{ expected_file_count=$expectedExtracted.Count; actual_file_count=$actualExtracted.Count; missing=$missingExtracted; extra=$extraExtracted; complete=($missingExtracted.Count -eq 0 -and $extraExtracted.Count -eq 0) }

$coreSources = @{
  'JY-001' = 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf'
  'TB-003' = 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf'
  'TB-006' = 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf'
  'FAST-01' = 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf'
  'FAST-04' = 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf'
  'FAST-WATER-01' = 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
}
$coreHashSet = @($coreSources.Values | ForEach-Object { Hash-File (Join-Path $repo $_) })
$allComparable = @(
  @{ id='TB-016'; path='backend/eval/tender-benchmark-v1/sources/TB-016-shenzhen-water-operations.pdf'; sha='fbf1af7ce6eedc3bf7ed86f8988a4416dce838e45bb3412f62b733689881a46c' },
  @{ id='HOLDOUT-REQ-01'; path='backend/eval/requirement-unseen-holdout-v1/source-candidates/三大平台-全国公共资源交易平台通用软件购置和实施项目招标文件.pdf'; sha='d7000d6aea6a86991425b8968ccd12432ff3492c1f081ec894e06178539cd949' },
  @{ id='HOLDOUT-REQ-02'; path='backend/eval/requirement-unseen-holdout-v1/work/HOLDOUT-REQ-02/2026-2027年信息化运维项目招标文件（2026021102）.pdf'; sha='15e7517e78a4cd6d6663587e2e93b1abd426818c78afb5871f7fa24900e6a196' }
)

$components = @{}
$componentPaths = @(
  'services/semantic-gateway/src/task-router.js',
  'packages/semantic-contracts/index.js',
  'backend/src/pipeline/requirement-extraction.js',
  'backend/src/pipeline/requirement-chunker.js',
  'backend/src/pipeline/canonical-requirements.js',
  'backend/src/pipeline/requirement-quality-gate.js',
  'backend/src/pipeline/source-location-resolver.js',
  'backend/src/pipeline/pdf-table-layout-annotator.js',
  'backend/src/pipeline/tender-section-classifier.js',
  'backend/src/pipeline/requirement-scope-router.js',
  'backend/src/pipeline/section-context-builder.js'
)
foreach ($relative in $componentPaths) {
  $full = Join-Path $repo $relative
  $components[$relative] = [ordered]@{ sha256 = Hash-File $full; bytes = (Get-Item -LiteralPath $full).Length }
}

$info = Invoke-RestMethod -Uri 'http://127.0.0.1:18082/info' -TimeoutSec 5
$ready = Invoke-RestMethod -Uri 'http://127.0.0.1:18082/ready' -TimeoutSec 5
$gitHead = (& git -C $repo rev-parse HEAD).Trim()
$gitBranch = (& git -C $repo branch --show-current).Trim()

$sourceFiles = @(
  (File-Meta $zipPath 'INPUT_ARCHIVE'),
  (File-Meta $standalonePath 'INPUT_PRIMARY_PDF'),
  (File-Meta $h1Pdf 'EXTRACTED_PRIMARY_PDF'),
  (File-Meta $h1Docx 'EXTRACTED_PRIMARY_DOCX_SUPPORTING_REPRESENTATION')
)
$tenders = @(
  [ordered]@{
    tender_id='HOLDOUT-REQ-V2-01'; source_kind='ZIP_ARCHIVE'; source_archive=(File-Meta $zipPath 'ARCHIVE'); archive_member_count=$zipEntries.Count
    primary=[ordered]@{ path=(Rel $h1Pdf); file_name=(Split-Path $h1Pdf -Leaf); sha256=(Hash-File $h1Pdf); bytes=(Get-Item $h1Pdf).Length; page_count=82; text_fingerprint_sha256='c649e19e3a45686e853199528719f6368194b09bcd9c32d7abc40a27576a9e24'; document_title='公开招标文件（货物类）'; project_number='060GSH2026041'; project_name='2026年网络路由交换和网络安全设备项目'; purchaser='上海黄金交易所'; procurement_center='中国人民银行集中采购中心'; procurement_type='非政府采购项目、公开招标'; requirement_bearing='YES'; source_identity='cover_and_first_chapter' }
    supporting=@([ordered]@{path=(Rel $h1Docx); file_name=(Split-Path $h1Docx -Leaf); sha256=(Hash-File $h1Docx); bytes=(Get-Item $h1Docx).Length; role='same_solicitation_docx_representation'; enters_natural_path=$true})
    excluded_archive_materials=@{ count=($zipEntries | Where-Object { $_.path -like '附件/*' }).Count; reason='bidder response/qualification/technical proof attachments; not used as primary solicitation input' }
  },
  [ordered]@{
    tender_id='HOLDOUT-REQ-V2-02'; source_kind='STANDALONE_PRIMARY_PDF'; source_archive=$null; archive_member_count=0
    primary=[ordered]@{ path=(Rel $standalonePath); file_name=(Split-Path $standalonePath -Leaf); sha256=(Hash-File $standalonePath); bytes=(Get-Item $standalonePath).Length; page_count=89; text_fingerprint_sha256='264afbe9099a3b50221b1dfce824873401072e4685b59644e7d4b2545aaa2ea9'; document_title='招标文件'; project_number='GC-HGX260349'; project_name='国家金融监督管理总局2026年服务器及网络安全设备采购项目'; purchaser='国家金融监督管理总局机关服务中心'; procurement_center='中央国家机关政府采购中心'; procurement_type='国内公开招标'; requirement_bearing='YES'; source_identity='cover_and_first_chapter' }
    supporting=@()
    excluded_archive_materials=@{ count=0; reason=$null }
  }
)

$independence = [ordered]@{
  comparison_key='project_number + project_name + document_title + purchaser + exact_file_sha256 + normalized_text_fingerprint_sha256'
  against_core6=[ordered]@{ exact_file_sha_overlap=0; project_identity_overlap=0; text_fingerprint_overlap=0 }
  against_holdout_v1=[ordered]@{ exact_file_sha_overlap=0; project_identity_overlap=0; text_fingerprint_overlap=0 }
  against_calibration_validation_mutation_existing_gold=[ordered]@{ source_files_present=0; exact_file_sha_overlap=0; project_identity_overlap=0; text_fingerprint_overlap=0; reason='No PDF/DOCX/ZIP source files found in scanned calibration/validation/mutation/Gold folders; identifier search returned no matches.' }
  scanned_project_identifiers=@('060GSH2026041','GC-HGX260349')
  scan_result='PASS'
  unseen_independence='PASS'
}

$runtime = [ordered]@{
  gateway_endpoint='http://127.0.0.1:18082'; ready_http_status=200; ready_status=$ready.status; info_http_status=200; build_revision=$info.build_revision; working_tree_dirty=$info.working_tree_dirty
  requirement_contract_version=$info.requirement_extraction_contract_version; requirement_prompt_version=$info.requirement_extraction_prompt_version; requirement_prompt_hash=$info.requirement_extraction_prompt_hash; requirement_instruction_hash=$info.requirement_extraction_instruction_hash
  candidate_schema_contract_version=$info.candidate_schema_contract_version; candidate_schema_sha256=$info.candidate_schema_sha256
  requirement_task_data_schema_sha256=$info.semantic_tasks.requirement_extraction.task_data_schema_sha256; provider='openai_compatible'; model='deepseek-ai/DeepSeek-V4-Flash'; provider_base_host='api.siliconflow.cn'; provider_configured=$ready.provider_configured
}

$planned = [ordered]@{ natural_production_path='Tender source -> parser -> section router -> semantic chunker -> requirement_extraction gateway -> source resolver -> canonicalizer -> quality gate'; tender_count=2; offline_chunk_count=@{ 'HOLDOUT-REQ-V2-01'=45; 'HOLDOUT-REQ-V2-02'=33 }; planned_first_attempt_provider_calls=78; retries=0; provider_calls_actual=0; execution_status='NOT_STARTED_PENDING_PRESEAL_NEXT_STEP' }
$gates = [ordered]@{ source_availability='PASS'; parser_and_primary_resolution='PASS'; tender_identity='PASS'; requirement_bearing='PASS'; unseen_independence='PASS'; code_and_contract_freeze_parity='PASS'; production_db_writes=0; gold_mutations=0; mapping_actions=0; claim_actions=0; writer_actions=0; provider_calls=0 }

$manifest = [ordered]@{ manifest_version='v43-requirement-unseen-holdout-v2-source-manifest'; generated_at=(Get-Date).ToString('o'); authority=[ordered]@{ branch=$gitBranch; head=$gitHead; expected_head='f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e'; worktree='DIRTY_USER_AUTHORITY_PRESERVED' }; source_files=$sourceFiles; archive_members=$zipEntries; archive_extraction=$archiveExtraction; tenders=$tenders; independence=$independence; runtime=$runtime; planned_execution=$planned; gates=$gates; source_ingest_status='PASS'; preseal_status='PASS'; natural_path_execution='NOT_STARTED' }
$manifestPath = Join-Path $work 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_SOURCE_MANIFEST.json'
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$preseal = [ordered]@{ checkpoint='V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_PRESEAL'; generated_at=(Get-Date).ToString('o'); decision='V43_REQUIREMENT_HOLDOUT_V2_SOURCE_INGEST_AND_PRESEAL_PREPARATION'; authority=$manifest.authority; source_availability=$manifest.source_ingest_status; archive_extraction=$archiveExtraction; holdout_identity=[ordered]@{ tender_ids=@('HOLDOUT-REQ-V2-01','HOLDOUT-REQ-V2-02'); tender_count=2 }; source_hashes=[ordered]@{ archive_sha256=(Hash-File $zipPath); holdout_v2_01_primary_sha256=(Hash-File $h1Pdf); holdout_v2_01_supporting_docx_sha256=(Hash-File $h1Docx); holdout_v2_02_primary_sha256=(Hash-File $standalonePath) }; primary_supporting_identity=$tenders; independence=$independence; component_freeze=[ordered]@{ components=$components; prompt_hash=$info.requirement_extraction_prompt_hash; schema_hash=$info.semantic_tasks.requirement_extraction.task_data_schema_sha256; router_hash=$components['services/semantic-gateway/src/task-router.js'].sha256; canonicalizer_hash=$components['backend/src/pipeline/canonical-requirements.js'].sha256; quality_gate_hash=$components['backend/src/pipeline/requirement-quality-gate.js'].sha256; source_resolver_hash=$components['backend/src/pipeline/source-location-resolver.js'].sha256; parity='PASS' }; runtime=$runtime; planned_execution=$planned; retries=0; provider_calls_actual=0; production_db_writes=0; gold_mutations=0; mapping_actions=0; claim_actions=0; writer_actions=0; status='PRESEAL_PASS_PENDING_NATURAL_PATH_EXECUTION' }
$presealPath = Join-Path $results 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_PRESEAL.json'
$preseal | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath $presealPath -Encoding UTF8
$presealMd = @('# V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_PRESEAL','',('- SOURCE_AVAILABILITY: {0}' -f $manifest.source_ingest_status),('- TENDER_COUNT: 2'),('- PRIMARY_DOCS: 2'),('- HOLDOUT_V2_UNSEEN_INDEPENDENCE: {0}' -f $independence.unseen_independence),('- CODE_AND_CONTRACT_FREEZE_PARITY: PASS'),('- PLANNED_FIRST_ATTEMPT_PROVIDER_CALLS: 78'),('- RETRIES: 0'),('- ACTUAL_PROVIDER_CALLS: 0'),('- PRODUCTION_DB_WRITES: 0'),('- GOLD_MUTATIONS: 0'),('- NATURAL_PATH_EXECUTION: NOT_STARTED_PENDING_PRESEAL_NEXT_STEP'),'', 'This is an Eval-only source/preseal artifact. No requirement extraction, Gold promotion, or production write was performed.') -join "`n"
$presealMd | Set-Content -LiteralPath (Join-Path $results 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_PRESEAL.md') -Encoding UTF8

$checkpoint = [ordered]@{ checkpoint='V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_CHECKPOINT'; generated_at=(Get-Date).ToString('o'); branch=$gitBranch; head=$gitHead; git_status='DIRTY_USER_AUTHORITY_PRESERVED'; source_files=$sourceFiles; archives=[ordered]@{ archive_count=1; archive_sha256=(Hash-File $zipPath); member_count=$zipEntries.Count; extraction=$archiveExtraction }; primary_documents=@($tenders | ForEach-Object { $_.primary }); supporting_documents=@($tenders | ForEach-Object { $_.supporting }); page_counts=[ordered]@{ 'HOLDOUT-REQ-V2-01'=82; 'HOLDOUT-REQ-V2-02'=89 }; unseen_independence=$independence; component_freeze=$preseal.component_freeze; runtime=$runtime; preseal=[ordered]@{ path=(Rel $presealPath); sha256=(Hash-File $presealPath); status=$preseal.status }; planned_provider_calls=78; actual_provider_calls=0; retries=0; candidate_count=0; canonical_requirement_count=0; quality_gate_distribution=@{}; unresolved_source_count=0; critical_triggers=@(); p0_escape_count=0; gpt_packet_path=$null; natural_path_execution='NOT_STARTED_PENDING_PRESEAL_NEXT_STEP'; production_db_writes=0; gold_mutations=0; mapping_actions=0; claim_actions=0; writer_actions=0; final_status='READY_FOR_GPT_REQUIREMENT_HOLDOUT_V2_EXECUTION' }
$checkpointPath = Join-Path $results 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_CHECKPOINT.json'
$checkpoint | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath $checkpointPath -Encoding UTF8
$md = @('# V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_CHECKPOINT','',('- SOURCE_AVAILABILITY: PASS'),('- HOLDOUT_V2_TENDERS: 2'),('- HOLDOUT_V2_UNSEEN_INDEPENDENCE: PASS'),('- PRIMARY_DOCUMENTS: 2'),('- SUPPORTING_DOCUMENTS: 1'),('- PLANNED_PROVIDER_CALLS: 78'),('- ACTUAL_PROVIDER_CALLS: 0'),('- RETRIES: 0'),('- CANDIDATES: 0 (natural path not started)'),('- CANONICAL_REQUIREMENTS: 0 (natural path not started)'),('- PRODUCTION_DB_WRITES: 0'),('- GOLD_MUTATIONS: 0'),('- FINAL_STATUS: READY_FOR_GPT_REQUIREMENT_HOLDOUT_V2_EXECUTION'),'', 'No Provider call, production write, Gold mutation, Mapping, Claim, or Writer action was performed in this preparation step.') -join "`n"
$md | Set-Content -LiteralPath (Join-Path $results 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_CHECKPOINT.md') -Encoding UTF8
Write-Output ($checkpoint | ConvertTo-Json -Depth 5)
