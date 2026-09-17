import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://bid_user:bid_password@127.0.0.1:5432/bid_platform_flow_audit_test' });
try {
  const result = await pool.query("SELECT m.original_name,m.index_status,COUNT(c.chunk_id)::int chunk_count,COUNT(e.embedding_id)::int embedding_count FROM company_materials m LEFT JOIN material_chunks c ON c.material_id=m.id LEFT JOIN material_chunk_embeddings e ON e.chunk_id=c.chunk_id WHERE m.original_name LIKE 'HW-%' GROUP BY m.original_name,m.index_status ORDER BY m.original_name");
  console.log(JSON.stringify(result.rows, null, 2));
} finally { await pool.end(); }
