# monitoring-rules

MVP for rules representaion, storing and calculation

# Representaion

Rule is a usual expression written in some human readable form. In this project expressions use javascript expressions syntax with some limitations:
- `and` and `or` are aliases for `&&` and `or`
- you can't use increment and decrement operators

Example rule: sepa incoming transaction with amount less then 5 eur and overall turnover of previous sepa incomings gretaer 1 EUR

```
trx.label="sepa-incoming" AND trx.amount<500 AND trx.currency="EUR" AND sum(past.amount,past.currency=trx.currency AND past.label=trx.label)>100
```
# Storing

Initial rule definintion is parsed using expressions grammar, validated for using only legal externals (like variable names, function calls), optimized and represented as AST tree
Example:
- input rule: `trx.amount < 30*100`
- optimized AST:
```json
{
    type: 'BinaryExpression',
    operator: '<',
    arguments: [
        {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'trx', weight: 1 },
            path: 'amount',
            weight: 2
            },
        { type: 'Literal', weight: 0, value: 3000 }
    ],
    weight: 3
}
```

Initial rule definition and corresponding AST must be stored to external storage for later use

# Calculation

We can calculate rule value easely using stored AST and current scope

Example 1:
- input rule: `trx.amount + 100`
- optimized AST:
```json
{
    type: 'BinaryExpression',
    operator: '+',
    arguments: [
      {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'trx', weight: 1 },
        path: 'amount',
        weight: 2
      },
      { type: 'Literal', value: 100, weight: 0 }
    ],
    weight: 3
}
```
- scope:
```json
{
    trx: {
      type: 'bank-incoming',
      label: 'sepa-incoming',
      amount: 500,
      currency: 'EUR',
      country: 'RU'
    }
  }
```
- result: `600`

Example 2 (generate SQL statement to query database):
- input: `sum(past.amount,past.currency="EUR","INTERVAL 1 WEEK")`
- ast:
```json
{
    type: 'CallExpression',
    callee: { type: 'Identifier', name: 'sum', weight: 1 },
    arguments: [
      { type: 'Literal', weight: 0, value: 't.amount' },
      { type: 'Literal', weight: 0, value: "(t.currency='EUR')" },
      { type: 'Literal', value: 'INTERVAL 1 WEEK', weight: 0 }
    ],
    weight: 102
}
```
- result: 
```sql
SELECT SUM(t.amount) FROM transactions AS t WHERE t.identity_id=:identityId AND (t.currency='EUR') AND t.created_at BETWEEN DATE_SUB(NOW(),INTERVAL 1 WEEK) AND NOW()
```
# Examples

- Playground: `./src/index.js`
- Usage: `node ./src/index.js 'trx.amount>1 ? "write your expression" : "Say bye bye"`


# Pros and cons
Pros:
- easy to write and read rule expressions grammar
- automatic syntax checking and validating for user input
- no need for special UI to represend rules
- simple parsing, validationg and optimizing with AST ready for use as a result

Cons:
- rules customer must have at least expirience with writing and understanding logical formulas (like in Excel)
- developer level: developer needs to have understanding of formal labguage grammars, parsers and AST for extending expressions engine