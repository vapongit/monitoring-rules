import _ from 'lodash';
import { internal, sql } from './engine/index.js';
import { internal as internalFeatures, sql as sqlFeatures } from './features/index.js';
import { parse } from './grammar.js';

const rule = process.argv[2] ?? '"Hello, world!"';

const { engine } = init();

let ast;

try {
    ast = parse(rule);
} catch (e) {
    console.error(e.message);

    process.exit();
}

const compiled = engine.validator.validate(ast);

const scope = {
    prohibitedCountries: ["BY","RU"],
    trx: {
        type: 'bank-incoming',
        label: 'sepa-incoming',
        amount: 500,
        currency: 'EUR',
        country: "RU"
    },
};

const result = await engine.valueOf(scope, compiled);

console.dir({ ast, compiled, scope, rule, result }, { depth: null });


function init() {
    const query = sql.createEngine({
        trx: {
            label: { type: 'placeholder', value: ':label' },
            amount: { type: 'placeholder', value: ':amount' },
            currency: { type: 'placeholder', value: ':currency' },
            country: { type: 'placeholder', value: ':country' },
    
        },
        past: {
            label: { type: 'field', value: 't.label' },
            amount: { type: 'field', value: 't.amount' },
            currency: { type: 'field', value: 't.currency' },
            country: { type: 'field', value: 't.country' },
        }
    });
    
    const engine = internal.createEngine({
        prohibitedCountries: { type: "array "},
        trx: {
            label: { type: "string" },
            amount: { type: 'number' },
            currency: { type: 'string' },
            country: { type: "string" },
        },
    });
    
    engine.addFeature('count', query.feature(
        sqlFeatures.featureCount.evaluator,
        sqlFeatures.featureCount.validator
    ));
    engine.addFeature('sum', query.feature(
        sqlFeatures.featureSum.evaluator,
        sqlFeatures.featureSum.validator
    ));
    engine.addFeature('isCredit', engine.feature(
        internalFeatures.featureIsCredit.evaluator,
        internalFeatures.featureIsCredit.validator
    ));
    engine.addFeature('isDebit', engine.feature(
        internalFeatures.featureIsDebit.evaluator,
        internalFeatures.featureIsDebit.validator
    ));

    return { engine, query };

}