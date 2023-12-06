export const validator = (expr, filter, period) => {
    return {
        type: 'function',
        weight: 100,
        value: {
            type: 'number',
        }
    };
};

export const evaluator = async (scope, expr, filter, period) => {
    const where = [
        't.identity_id=:identityId',
    ];
    if (filter) {
        where.push(filter);
    }
    if(period) {
        where.push(`t.created_at BETWEEN DATE_SUB(NOW(),${period}) AND NOW()`);
    } else {
        where.push('t.created_at<=NOW()');
    }

    const sql = `SELECT SUM(${expr}) FROM transactions AS t WHERE ${where.join(' AND ')}`;

    return sql; 
}
