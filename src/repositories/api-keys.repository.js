function mapKey(row) {
  return row && {
    id: row.id, name: row.name, keyPrefix: row.key_prefix,
    scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes,
    lastUsedAt: row.last_used_at, expiresAt: row.expires_at,
    revokedAt: row.revoked_at, createdAt: row.created_at
  };
}
const columns = 'id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at';
function createApiKeysRepository({ db }) {
  return {
    async create(payload) {
      const [result] = await db.execute(
        'INSERT INTO api_keys (name, key_prefix, key_hash, scopes, expires_at) VALUES (?, ?, ?, ?, ?)',
        [payload.name, payload.keyPrefix, payload.keyHash, JSON.stringify(payload.scopes), payload.expiresAt]
      );
      return this.findById(result.insertId);
    },
    async findById(id) {
      const [rows] = await db.execute(`SELECT ${columns} FROM api_keys WHERE id = ?`, [id]);
      return mapKey(rows[0]);
    },
    async findByPrefix(prefix) {
      const [rows] = await db.execute(`SELECT ${columns}, key_hash FROM api_keys WHERE key_prefix = ?`, [prefix]);
      return rows.map((row) => ({ ...mapKey(row), keyHash: row.key_hash }));
    },
    async list() {
      const [rows] = await db.execute(`SELECT ${columns} FROM api_keys ORDER BY id DESC`);
      return rows.map(mapKey);
    },
    async revoke(id) {
      await db.execute('UPDATE api_keys SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE id = ?', [id]);
      return this.findById(id);
    },
    async markUsed(id) {
      const [result] = await db.execute(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`, [id]);
      return result.affectedRows > 0;
    }
  };
}
module.exports = { createApiKeysRepository };
