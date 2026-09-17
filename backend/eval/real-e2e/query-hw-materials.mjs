import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://bid_user:bid_password@127.0.0.1:5432/bid_platform_flow_audit_test' });
try {
  const result = await pool.query("SELECT id,project_id,original_name,file_hash,index_status,extraction_status,corpus_scope,authority_level,review_status,lifecycle_status,usage_status FROM company_materials WHERE original_name LIKE 'HW-%' ORDER BY original_name");
  console.log(JSON.stringify(result.rows, null, 2));
} finally { await pool.end(); }
