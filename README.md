# cloudwatchlogger

[![NPM Version](https://img.shields.io/npm/v/cloudwatchlogger.svg)](https://npmjs.org/package/cloudwatchlogger)
[![Build Status](https://travis-ci.org/rajatkumar/cloudwatchlogger.svg?branch=master)](https://travis-ci.org/rajatkumar/cloudwatchlogger)
[![Coverage Status](https://coveralls.io/repos/github/rajatkumar/cloudwatchlogger/badge.svg?branch=master)](https://coveralls.io/github/rajatkumar/cloudwatchlogger?branch=master)
[![Dependency Status](https://david-dm.org/rajatkumar/cloudwatchlogger.svg)](https://david-dm.org/rajatkumar/cloudwatchlogger)
[![devDependency Status](https://david-dm.org/rajatkumar/cloudwatchlogger/dev-status.svg)](https://david-dm.org/rajatkumar/cloudwatchlogger#info=devDependencies)
[![bitHound Score](https://www.bithound.io/github/rajatkumar/cloudwatchlogger/badges/score.svg)](https://www.bithound.io/github/rajatkumar/cloudwatchlogger/master)
[![nsp status](https://img.shields.io/badge/NSP%20status-no%20vulnerabilities-green.svg)](https://travis-ci.org/rajatkumar/cloudwatchlogger)

> Module to log directly to AWS CloudWatchLogs in NodeJS

`cloudwatchlogger` is a module that allows your Node.js app to send logs
directly to AWS CloudWatchLogs.

* Creates LogGroups and LogStream if it doesnot exist
* Configurable batch size and retry options
* Provides a streaming interface
* CLI interface

## Getting Started

Install the module with: `npm install cloudwatchlogger --save`

Install the module as a CLI tool `npm install cloudwatchlogger -g`


## Usage

## API

You can use the module by requiring and creating an instance of the
logger by providing the AWS credentials and other options.

```js
const Logger = require('cloudwatchlogger');

new Logger(OPTS).setupLogger('myGroupNameTest', 'myStreamNameTest',
        function(err, logger) {
            // logger is your actual logger instance
        }

```


Once you have the `logger`, you can call `.log()` function


```js

    logger.log('Some Text'); // string
    logger.log(42); // number
    logger.log(true); // boolean
    logger.log({test:true}); // JSON

```

## Logger OPTS

Logger OPTS allows you to pass in AWS credentials and few more options to control
cloudwatchlogger behaviour.

OPTS needs to be a JSON like this:

```json
{
    "accessKeyId": "XXXXX", // required
    "secretAccessKey": "YYYYY", // required
    "region": "us-west-2", // required
    "logLevel": "trace", // [optional] Use `Trace` if you want to see library logs
    "batchSize": 1024, // [optional] Messages are sent in batches of this size
    "batchDelay": 3000, // [optional] Delay before it sends if no messages are logged
    "maxRetries": 2 // [optional] Num of retries if posting to AWS fails
}

```

### Full Example with Restify Server

```js


'use strict'

const restify = require('restify');
const Logger = require('cloudwatchlogger');
let logger = null;
const server = restify.createServer({name: 'app'});
const opts = {
    "accessKeyId": "XXXXX", // required
    "secretAccessKey": "YYYYY", // required
    "region": "us-west-2", // required
    "logLevel": "trace", // [optional] Use `Trace` if you want to see library logs
    "batchSize": 1024, // [optional] Messages are sent in batches of this size
    "batchDelay": 3000, // [optional] Delay before it sends if no messages are logged
    "maxRetries": 2 // [optional] Num of retries if posting to AWS fails
};

/*
or, ask logger to read the AWS config from file json file
const opts = {
    "file":"./aws.config.json",
    "logLevel": "trace",
    "batchSize": 1024,
    "batchDelay": 3000,
    "maxRetries": 2
}
 */


server.pre( (req, res, next) => {
    req.id = 'RandomId123';
    // Example: Req object is circular with lots of other info
    // you would want to serialize it to a format that suits you
    logger.log({ method: req.method,
        url: req.url,
        id: req.id, // Example - assign and log a req id
        // later you can query in CloudWatchLogger with
        headers: req.headers,
        remoteAddress: req.connection.remoteAddress,
        remotePort: req.connection.remotePort });
    next();
});


server.get('/',  (req, res) => {
    logger.log('Some Text'); // string
    logger.log(42); // number
    logger.log(true); // boolean
    logger.log({test:true}); // JSON
    logger.log({
        statusCode: res.statusCode,
        id: req.id,
        header: res._header
    });
    res.send('hello world');
    next();
});


server.listen(3003, () => {
    // get an instance of logger and pass in the AWS CloudWatchLogs Group Name
    // and Stream Name
    // If GroupName or StreamName does not exists, library will create one for
    // you
    new Logger(opts).setupLogger('myGroupNameTest', 'myStreamNameTest',
        function(err, loggerInstance) {
            // you get back a loggerInstance when it establishes that log group
            // and log streams are valid
            logger = loggerInstance;
            console.log('Server listening on 3003 with CloudWatchLogger');
        });
});

```


## Contributing

Ensure that all linting and codestyle tasks are passing. Add unit tests for any
new or changed functionality.

To start contributing, install the git prepush hooks:

```sh
make githooks
```

Before committing, lint and test your code using the included Makefile:
```sh
make prepush
```

If you have style errors, you can auto fix whitespace issues by running:

```sh
make codestyle-fix
```

## License

Copyright (c) 2017 Rajat Kumar

Licensed under the MIT license.
