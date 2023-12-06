import _ from "lodash";

const Operators = {
    UnaryExpression: {
        '+': ([argument]) => `+(${argument})`,
        '-': ([argument]) => `-(${argument})`,
        '~': ([argument]) => `~(${argument})`,
        '!': ([argument]) => `NOT (${argument})`,
    },
    BinaryExpression: ((fns) => ({
        '**': ([left, right]) => `POWER(${left},${right})`,
        '*': fns.simple('*'),
        '/': fns.simple('/'),
        '%': fns.simple('%'),
        '+': fns.simple('+'),
        '-': fns.simple('-'),
        '<<': fns.simple('<<'),
        '>>': fns.simple('>>'),
        // '>>>': ([left, right]) => left >>> right,
        '<=': fns.simple('<='),
        '>=': fns.simple('>='),
        '<': fns.simple('<'),
        '>': fns.simple('>'),
        '=': fns.simple('='),
        '!=':fns.simple('!='),
        '<>': fns.simple('!='),
        '&': fns.simple(' & '),
        '^': fns.simple(' ^ '),
        '|': fns.simple(' | '),
        'in': ([left, right]) => {
            return _.isArray(right)
                ? `${left} IN (${right.join(',')})`
                : `${left}=${right}`;
        },
    }))({
        simple: (op) => (args) => `(${args.join(op)})`,
    }),
    LogicalExpression: ((fns) => ({
        and: fns.and,
        '&&': fns.and,
        or: fns.or,
        '||': fns.or,
    }))({
        and: (args) => args.join(' AND '),
        or: (args) => args.join(' OR '),
    }),
    LogicalExpressionFilter: ((fns) => ({
        and: fns.and,
        '&&': fns.and,
        or: fns.or,
        '||': fns.or,
    }))({
        and: (conditions) => conditions.reduce((acc, v) => {
            if (Boolean(acc)===false) {
                return acc;
            } else if (v.type === 'Literal' && Boolean(v.value)===false) {
                return v.value;
            }

            acc.push(v);

            return acc;
        }, []),
        or: (conditions) => conditions.reduce((acc, v) => {
            if (Boolean(acc)===true) {
                return acc;
            } else if (v.type === 'Literal' && Boolean(v.value)===true) {
                return v.value;
            }

            acc.push(v);

            return acc;
        }),
    }),
};

class NodeEvaluationResult {
    constructor(type, node, value) {
        this.type = type;
        this.node = node;
        this.value = value;
    }

    get weight() {
        return this.node.weight;
    }

    valueOf() {
        return this.value;
    }

}

class LiteralResult extends NodeEvaluationResult {}
class IdentifierResult extends NodeEvaluationResult {}
class FeatureResult extends NodeEvaluationResult {}

export class EngineValidator {
    validating = true;
    $schema = {};
    $feature = {};

    constructor(schema) {
        this.$schema = _.cloneDeep(schema);
    }

    get schema() {
        return this.$schema;
    }

    feature(validator) {
        const engine = this;

        return Object.defineProperty(validator.bind(this), 'valueOf', {
            enumerable: false,
            value: (argument) => engine.valueOf(argument)
        });
    }

    addFeature(name, feature) {
        this.$feature[name] = feature;
    }

    validate(ast) {
        return this.valueOf(_.cloneDeep(ast)).node;
    }

    valueOf(argument) {
        try {
            if(argument instanceof NodeEvaluationResult) {
                return argument;
            }
            // console.log('-v---------------------------');
            //console.dir(argument, { depth: null });
            //console.log('-v^--------------------------');
            const result = this[argument.type](argument);
            // console.dir({ argument, result }, { depth: null });
            // console.log('-^---------------------------');
            return result;
        } catch(e) {
            throw SyntaxError(`valueOf ${JSON.stringify(argument)}`, { cause: e });
        }
    }
    UnaryExpression(node /* { operator, argument } */) {
        node.weight = 1;

        const [args, newNode] = this.tryToEvaluate(node, Operators.UnaryExpression[node.operator]);
        
        if (newNode) {
            return this.valueOf(newNode);
        }

        return new NodeEvaluationResult(
            _.uniq(args.map(v => v.type)),
            node
        );
    }
    BinaryExpression(node /* { operator, arguments } */) {
        node.weight = 1;

        const [args, newNode] = this.tryToEvaluate(node, Operators.BinaryExpression[node.operator]);

        if (newNode) {
            return this.valueOf(newNode);
        }

        return new NodeEvaluationResult(
            _.uniq(args.map(v => v.type)),
            node
        );
    }
    LogicalExpression(node /* { operator, arguments } */) {
        node.weight = 1;

        const [,newNode] = this.tryToEvaluate(node, Operators.LogicalExpression[node.operator]);

        if (newNode) {
            return this.valueOf(newNode);
        }

        const args = [];

        for (const child of node.arguments) {
            if (this.isTheSameOp(node, child)) {
                args.push(...child.arguments);
            } else {
                args.push(child);
            }
        }
        
        const filteredArgsOrResult = Operators.LogicalExpressionFilter[node.operator](args);

        if (Array.isArray(filteredArgsOrResult)) {
            node.arguments = filteredArgsOrResult;
        } else { 
            delete node.operator;
            Object.assign(node, filteredArgsOrResult);

            return this.valueOf(node);
        }

        return new NodeEvaluationResult('boolean', node);
    }
    ArrayExpression(node /* { elements } */) {
        node.weight = 1;
        
        const result = node.elements.map(value => {
            const v = this.valueOf(value);

            node.weight +=v.weight;

            return v;
        });

        if (result.every(v => v instanceof LiteralResult)) {
            node.type = 'Literal';
            node.value = result.map(v => v.valueOf());

            delete node.elements;

            return this.Literal(node, false);
        }

        return new NodeEvaluationResult('array', node, result);
    }
    ConditionalExpression(node /* {test, consequent, alternate} */) {
        const testResult = this.valueOf(node.test);
        const consequentResult = this.valueOf(node.consequent);
        const alternateResult = this.valueOf(node.alternate);

        if (testResult instanceof LiteralResult) {
            delete node.test;
            delete node.consequent;
            delete node.alternate;

            Object.assign(node, testResult.valueOf()
                ? consequentResult.node
                : alternateResult.node
            );

            return this.valueOf(node);
        }

        node.weight = testResult.weight + Math.max(consequentResult.weight, alternateResult.weight) + 1;

        return new NodeEvaluationResult(
            [consequentResult.type, alternateResult.type],
            node
        );
    }
    SequenceExpression(node /* { expressions } */) {
        const result =  this.valueOf(_.last(node.expressions));

        if(result instanceof LiteralResult) {
            node.type = 'Literal';
            node.value = result.valueOf();

            delete node.expressions;

            return this.Literal(node);
        }

        node.weight = result.weight + 1;

        return NodeEvaluationResult(result.type, node, result.value);
    }
    CallExpression(node /* { callee, arguments } */) {
        const {
            value: concreteCallee,
            weight = 0,
        } = this.valueOf(node.callee);

        node.weight = weight + 1;

        const result = concreteCallee(...node.arguments.map(argument => {
            const value = (concreteCallee.valueOf ?? this.valueOf)(argument);

            node.weight += value.weight;

            return value;
        }));

        node.weight += result.weight;

        return new NodeEvaluationResult(result.value.type,node, result.value);
    }
    MemberExpression(node /* { object, path } */) {
        const target = this.valueOf(node.object);

        node.weight = target.weight + 1;

        const value = _.get(target.valueOf(), node.path);
        
        if(!value) {
            throw SyntaxError(`Unknown path ${JSON.stringify(node.path)}`);
        }

        if (value.type === 'field' || value.type === 'placeholder') {
            node.type = 'Literal';
            node.value = value.value;

            delete node.object;
            delete node.path;

            return this.Literal(node, false);
            
        }

        return new NodeEvaluationResult(value.type, node, value);
    }

    Identifier(node /* { name } */) {
        node.weight = 1;

        if (this.$feature[node.name]) {
            const value = this.$feature[node.name];

            return new FeatureResult(typeof value, node, value);
        }

        if(this.$schema[node.name]) {
            const value = this.$schema[node.name];

            return new IdentifierResult(value.type ?? typeof value, node, value);
        }

        throw SyntaxError(`Unknown identifier ${JSON.stringify(node.name)}`);
    }
    Literal(node /* { value } */, escape = true) {
        node.weight = 0;

        const type = _.isArray(node.value)
            ? 'array'
            : typeof node.value;

        const value = escape
            ? `'${node.value}'`
            : node.value;
        return new LiteralResult(type, node, value);
    }

    // --- Utility helpers ---
    isTheSameOp(parent, child) {
        return parent.type===child.type && parent.operator===child.operator;
    }

    tryToEvaluate(node, operation) {
        const args = node.arguments.map(arg => {
            const value = this.valueOf(arg);

            node.weight += value.weight;

            return value;
        });

        if (args.every(value => value instanceof LiteralResult)) {
            node.type = 'Literal';
            node.value = operation(args.map(v => v.valueOf()));

            delete node.operator;
            delete node.arguments;

            return [args, this.Literal(node, false)];
        }

        return [args];
    }
}

