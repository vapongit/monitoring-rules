import _ from "lodash";

const Operators = {
    UnaryExpression: {
        '+': (argument) => +argument,
        '-': (argument) => -argument,
        '~': (argument) => ~argument,
        '!': (argument) => !argument,
    },
    BinaryExpression: {
        '**': (left, right) => left ** right,
        '*': (left, right) => left * right,
        '/': (left, right) => left / right,
        '%': (left, right) => left % right,
        '+': (left, right) => left + right,
        '-': (left, right) => left - right,
        '<<': (left, right) => left << right,
        '>>': (left, right) => left >> right,
        '>>>': (left, right) => left >>> right,
        '<=': (left, right) => left <= right,
        '>=': (left, right) => left >= right,
        '<': (left, right) => left < right,
        '>': (left, right) => left > right,
        '=': (left, right) => left == right,
        '!=': (left, right) => left != right,
        '<>': (left, right) => left != right,
        '&': (left, right) => left & right,
        '^': (left, right) => left ^ right,
        '|': (left, right) => left | right,
        'in': (left, right) => _.castArray(right).includes(left),
    },
    LogicalExpression: ((fns) => ({
        and: fns.and,
        '&&': fns.and,
        or: fns.or,
        '||': fns.or,
    }))({
        async and(values) {
            let lastValue;
            for await(const v of values) {
                if(Boolean(v)===false) {
                    return v;
                }

                lastValue = v;
            }
            
            return lastValue;
        },
        async or(values) {
            let lastValue;
            for await(const v of values) {
                if(Boolean(v)===true) {
                    return v;
                }

                lastValue = v;
            }
            
            return lastValue;
        }
    }),
};

export class Engine {
    validating = false;
    $validator = null;
    $feature = {};

    constructor(validator) {
        this.$validator = validator;
    }

    feature(evaluator, validator) {
        const engine = this;
        const concreteValidator = (validator || evaluator);

        return Object.defineProperties(evaluator.bind(this), {
            valueOf: { enumerable: false, value: (scope, argument) => engine.valueOf(scope, argument) },
            validator: { enumerable: false, value: this.$validator.feature(concreteValidator) }
        });
    }

    addFeature(name, feature) {
        this.$feature[name] = feature;
        this.$validator.addFeature(name, feature.validator);
    }

    get validator() {
        return this.$validator;
    }

    async valueOf(scope, argument) {
        try {
            return this[argument.type](scope, argument);
        } catch(e) {
            throw SyntaxError(`valueOf ${JSON.stringify(argument)}`, { cause: e });
        }
    }
    async UnaryExpression(scope, { operator, arguments: [argument] }) {
        return Operators.UnaryExpression[operator](await this.valueOf(scope, argument));
    }
    async BinaryExpression(scope, { operator, arguments: [left, right] }) {
        return Operators.BinaryExpression[operator](
            await this.valueOf(scope, left),
            await this.valueOf(scope, right)
        );
    }
    async * LogicalExpressionValues(scope, conditions) {
        for(const condition of conditions) {
            yield this.valueOf(scope, condition);
        }
    }
    async LogicalExpression(scope, { operator, arguments: args }) {
        const conditions = [...args];

        conditions.sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));

        const values = this.LogicalExpressionValues(scope, conditions);

        return Operators.LogicalExpression[operator](values);
    }
    async ArrayExpression(scope, { elements }) {
        return Promise.all(elements.map(value => this.valueOf(scope, value)));
    }
    async ConditionalExpression(scope, {test, consequent, alternate}) {
        return await this.valueOf(scope, test)
            ? this.valueOf(scope, consequent)
            : this.valueOf(scope, alternate);
    }
    async SequenceExpression(scope, { expressions }) {
        return this.valueOf(scope, _.last(expressions.pop()));
    }
    async CallExpression(scope, { callee, arguments: args }) {
        const concreteCallee = await this.valueOf(scope, callee);

        return concreteCallee(...[scope, ...await Promise.all(args.map(
            argument => (concreteCallee.valueOf || this.valueOf)(scope, argument))
        )]);
    }
    async MemberExpression(scope, { object, path }) {
        return this.valueOf(scope, object).then(result => _.get(result, path));
    }
    Identifier(scope, { name }) {
        if(this.$feature[name]) {
            return this.$feature[name];
        }

        return scope[name];
    }
    Literal(scope, { value }) {
        return value;
    }
}
