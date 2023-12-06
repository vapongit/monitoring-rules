export const validator = () => {
    return {
        type: 'function',
        weight: 1,
        value: {
            type: 'boolean',
        }
    };
};

const debitTypes = new Set([
    'bank-outgoing',
    'card-outgoing',
    'settlement-outgoing',
    'invoice-payment',
    'bank-fee',
    'card-fee',
]);

export const evaluator = async (scope) => {
    return debitTypes.has(scope.trx.type);
}
