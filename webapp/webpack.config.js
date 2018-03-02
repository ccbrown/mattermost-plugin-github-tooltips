module.exports = {
    entry: './index.js',
    output: {
        filename: 'dist/github_tooltips_bundle.js'
    },
    module: {
        loaders: [
            {
                test: /\.(js|jsx)?$/,
                loader: 'babel-loader',
                exclude: /(node_modules|non_npm_dependencies)/,
                query: {
                    presets: [
                        'react',
                        ['env', {modules: false}],
                        'stage-0'
                    ],
                    plugins: ['transform-runtime']
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    }
};
