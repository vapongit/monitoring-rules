module.exports = {
    extends: [
        'airbnb',
        'plugin:@peggyjs/recommended',
    ],
    rules: {
        // alphabetically sorted list of base rules' overrides
        indent: ['error', 4, { SwitchCase: 1 }],
    },
};
