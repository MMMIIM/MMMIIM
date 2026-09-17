import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://bid_user:bid_password@127.0.0.1:5432/bid_platform_flow_audit_test' });
const projectId = '241cd448-f62b-49b2-b002-00a48f7cdf91';
try {
  const jobs = await pool.query('SELECT * FROM tender_parse_jobs WHERE project_id=$1', [projectId]);
  console.log(JSON.stringify(jobs.rows, null, 2));
  if (jobs.rows[0]) {
    const chunks = await pool.query('SELECT * FROM tender_parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number', [jobs.rows[0].id]);
    console.log(JSON.stringify(chunks.rows, null, 2));
  }
} finally { await pool.end(); }
