#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var program = require('commander')
var converters = require('../index')

program
    .version(require('../package.json').version)
    .option('<source>', 'path to the source file')
    .option('-p, --pretty', 'prettify result')
    .option('-e, --export [export]', 'string to add before the json to make it accessible, defaults to "module.exports = "', String, 'module.exports = ')

program
    .command('*')
    .description('path to the source file')
    .action(function (source) {
        if (source[0] != '/') source = path.resolve(process.cwd(), source)
        program.sourcePath = source
    })

program.parse(process.argv)

if (!program.args.length) return program.help()

var converterExtMap = {
    '.css': converters.cssToJss
}

;(function convert() {
    var code = fs.readFileSync(program.sourcePath, 'utf-8')
    var ext = path.extname(program.sourcePath)
    var jss = converterExtMap[ext](code)
    var spaces = program.pretty ? '  ' : ''
    var output = JSON.stringify(jss, null, spaces)
    var jssString = program.export + output + ';'
    console.log(jssString)
}())