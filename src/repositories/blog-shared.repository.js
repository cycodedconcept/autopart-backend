function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeSqlTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  if (typeof value === 'string') {
    const parsedValue = new Date(value);

    if (Number.isNaN(parsedValue.getTime())) {
      return value;
    }

    return parsedValue.toISOString().slice(0, 19).replace('T', ' ');
  }

  return value;
}

function buildPublicBlogPostVisibilitySql(tableAlias = 'bp') {
  return `
    ${tableAlias}.status = 'published'
    AND ${tableAlias}.published_at IS NOT NULL
    AND ${tableAlias}.published_at <= NOW()
  `;
}

function buildUpdateStatement(payload, fieldMappings) {
  const assignments = [];
  const params = [];

  for (const field of fieldMappings) {
    if (payload[field.key] === undefined) {
      continue;
    }

    assignments.push(`${field.column} = ?`);
    params.push(field.transform ? field.transform(payload[field.key]) : payload[field.key]);
  }

  return {
    assignments,
    params
  };
}

module.exports = {
  buildPublicBlogPostVisibilitySql,
  buildUpdateStatement,
  normalizeSqlTimestamp,
  toNumber
};
