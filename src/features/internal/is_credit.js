export const validator = () => {
    return {
        type: 'function',
        weight: 1,
        value: {
            type: 'boolean',
        }
    };
};

const creditTypes = new Set([
    'bank-incoming',
    'card-incoming',
    'settlement-incoming',
]);

export const evaluator = async (scope) => {
    return creditTypes.has(scope.trx.type);
}
