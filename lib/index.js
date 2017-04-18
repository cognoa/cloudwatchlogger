'use strict'

const CloudWatchLogsStream = require('./CloudWatchLogger');
const safeStringify = require('fast-safe-stringify');
class Logger {
    constructor (opts) {
        this.cwlsObject = new CloudWatchLogsStream(opts);
        this.stream = this.cwlsObject.stream;
    }

    setupLogger (logGroupName, logStreamName, done) {
        this.cwlsObject.createLogger(logGroupName, logStreamName, (err) => {
            done(err, this);
        });
    }

    log (logText, done) {
        this.cwlsObject.log(safeStringify(logText), done);
    }

    getStream() {
        return this.stream;
    }

}

module.exports = Logger;
