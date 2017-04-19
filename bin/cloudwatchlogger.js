#!/usr/bin/env node
'use strict';

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const split = require('split2');
const pump = require('pump');

const realPath = fs.realpathSync(__dirname);
const pkgJsonVersion = JSON.parse(fs.readFileSync(
    path.join(realPath, '..', 'package.json'))).version;
const Logger = require(path.join(realPath, '..', 'lib', 'index.js'));
const cli = require('commander');

process.on('SIGINT', function() {
    console.log('Got a SIGINT. Goodbye.');
    process.exit(0);
});

cli.version(pkgJsonVersion)
    .usage('[options]')
    .option('-a, --accessKeyId <accessKeyId>', 'AWS Access Key Id')
    .option('-s, --secretAccessKey <secretAccessKey>', 'AWS Secret Access Key')
    .option('-r, --region <region>', 'AWS Region')
    .option('-l, --logStreamName <logStreamName>', 'CloudWatch Log Stream Name')
    .option('-g, --logGroupName <logGroupName>', 'Cloud Watch Log Group Name')
    .option('-f, --file <pathToFile>',
        'or, Config JSON file containing AWS Credentials')
    .option('-d, --debug', '[optional] Enables debug logs for this library')
    .option('-m, --maxRetry <value>', '[optional] Max retries per log batch',
        parseInt)
    .option('-b, --batchSize <value>', '[optional] Batch size', parseInt)
    .parse(process.argv);

main(cli);

function main(cliOptions) {
    let AWSOptions = null;
    let logStreamName = null;
    let logGroupName = null;

    if (cliOptions.accessKeyId &&
        cliOptions.secretAccessKey && cliOptions.region) {
        AWSOptions = {
            accessKeyId: cliOptions.accessKeyId,
            secretAccessKey: cliOptions.secretAccessKey,
            region: cliOptions.region
        };
    }
    else if (cliOptions.file) {
        AWSOptions = {
            file: cliOptions.file
        };
    }
    else {
        console.log('Invalid AWS Options');
        process.exit(1);
    }

    if (cliOptions.logStreamName && cliOptions.logGroupName) {
        logStreamName = cliOptions.logStreamName;
        logGroupName = cliOptions.logGroupName;
    }
    else {
        console.log('Invalid LogStreamName and/or LogGroupName');
        process.exit(1);
    }

    if (cliOptions.debug) {
        AWSOptions.logLevel = 'trace';
    }

    if (cliOptions.maxRetry) {
        AWSOptions.maxRetries = cliOptions.maxRetry;
    }

    if (cliOptions.batchSize) {
        AWSOptions.batchSize = cliOptions.batchSize;
    }

    console.log(AWSOptions);

    new Logger(AWSOptions).setupLogger(logGroupName, logStreamName,
        function(err, logger) {
        if (err) {
            console.log('Error', err);
            process.exit(1);
        }
        else {
            pump(process.stdin, split(), logger.getStream());
        }

    });
}
