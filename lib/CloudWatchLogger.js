'use strict'

const AWS = require('aws-sdk');
const pinoLib = require('pino');
const Queue = require('better-queue');
const Through = require('through2');
let pino = null;

class CloudWatchLogsStream {
    constructor (opts) {
        pino = pinoLib({ level: opts.logLevel || 'silent', prettyPrint: true });
        pino.trace('Constructor Opts', opts);

        if (!opts.file &&
                !(opts.accessKeyId && opts.secretAccessKey && opts.region)) {
            throw Error('AWS credential parameters are missing');
        }

        if (opts.file) {
            AWS.config.loadFromPath(opts.file);
        } else {
            AWS.config.update({
                accessKeyId: opts.accessKeyId,
                secretAccessKey: opts.secretAccessKey,
                region: opts.region
            });
        }
        // config
        this.timeout = opts.timeout || 5000;
        this.batchSize = opts.batchSize || 1000;
        this.maxRetries = opts.maxRetries || 2;
        this.batchDelay = opts.batchDelay || 2000;
        // pin to version
        this.cwLogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28' });

        //this.logBuffer = []
        // setup the Logging Queue
        const workerFunction = this._pushToCloudWatchLogs.bind(this);
        this.logQueue = new Queue(workerFunction,
          {
            maxRetries: this.maxRetries,
            batchSize: this.batchSize, // how many do we process at a time
            batchDelay: this.batchDelay,
            batchDelayTimeout: this.timeout,
            failTaskOnProcessException: false
        }
        );

        this.logQueue.on('task_finish', function(taskId, result, stats) {
            pino.trace('task_finish', taskId, result, stats);
        });
        this.logQueue.on('task_failed', function(taskId, errorMessage, stats) {
            pino.trace('task_failed', taskId, errorMessage, stats);
        });

        const exposeTransform = this.streamChunks.bind(this);
        this.stream = Through.obj(exposeTransform);

        pino.trace('Log Queue created');
    }


    streamChunks (chunk, enc, callback) {
        pino.trace('Streaming Chunks', chunk);
        //chunk = safeStringify(chunk);
        this.log(chunk);
        callback();
    }


    log (message, done) {
        // We don't need to setup event listeners
        // but this helps with unit-tests
        /* eslint-disable consistent-return */
        this.logQueue.push({ message, timestamp: Date.now()})
            .on('finish', function(result) {
                if (done) {
                    return done(null, result);
                }
            })
            .on('failed', function(err) {
                if (done) {
                    return done(err);
                }
            });
        /* eslint-enable consistent-return */
    }

    _pushToCloudWatchLogs (logs, batchCallback) {
        let batchLogs = logs;

        if (!Array.isArray(logs)) {
            // single item, now converting to array
            batchLogs = [logs];
        }
        // build the payload
        const payloadBody = {
            logStreamName: this.logStreamName,
            logGroupName: this.logGroupName,
            logEvents: batchLogs
        };
        // for the 1st time logs are sent, we might not have
        // a valid sequence token
        if (this.sequenceToken) {
            payloadBody.sequenceToken = this.sequenceToken;
        }
        pino.trace('Posting Logs', payloadBody);
        // call the service to upload our logs
        this._putLogs(payloadBody, (err, data) => {
            if (!err && data) {
                // yay! we posted our logs
                pino.trace('Logs posted successfully', data);
                this.sequenceToken = data.nextSequenceToken;
                return batchCallback(null);
            } else {
                // oops, looks like we conked
                pino.trace('Logs posting errored', err, data);

                if (err.code === 'InvalidSequenceTokenException') {
                    // this can be handled by resetting the sequenceToken
                    // and retrying
                    return this._resetSequenceToken(payloadBody.logGroupName,
                        payloadBody.logGroupName, (errReset) => {
                        if (errReset) {
                            // resetting failed, lets fail the batch job
                            pino.trace('Resetting sequence token failed',
                              errReset);
                        }
                        // resetting fails or succeeds, we dont care,
                        // we still mark this batch as failed.
                        // and our queue should pick it up as part of retry
                        return batchCallback(errReset ||
                            'InvalidSequenceTokenException');
                    });
                }
                else if (err.code === 'DataAlreadyAcceptedException') {
                    // since it is already accepted, lets move on to next batch
                    return batchCallback(null);
                }
                else {
                    // for every other error -  it is still an error
                    return batchCallback(err);
                }
            }
        });
    }

    _createGroup (logGroupName, done) {
        this.cwLogs.createLogGroup({
            logGroupName
        }, done);
    }

    _createStream (logStreamName, logGroupName, done) {
        this.cwLogs.createLogStream({
            logGroupName,
            logStreamName
        }, done);
    }

    _putLogs (logPayload, done) {
        // as dumb as it can be!
        this.cwLogs.putLogEvents(logPayload, done);
    }

    _resetSequenceToken (logGroupName, logStreamName, done) {
        this.cwLogs.describeLogStreams({
            logGroupName: logGroupName,
            logStreamNamePrefix: logStreamName,
            limit: 1
        }, (err, data) => {
            if (err) {
                // oops
                return done(err);
            } else {
                if (data && data.logStreams.length === 1 &&
                  data.logStreams[0].uploadSequenceToken) {
                    this.sequenceToken = data.logStreams[0].uploadSequenceToken;
                    return done(null);
                } else {
                    pino.trace('API Sequence Token Not Available', data);
                    return done(new Error('API Sequence Token Not Available'));
                }
            }
        });
    }

    createLogger (logGroupName, logStreamName, callback) {
        // try creating a group
        pino.trace('Create Logger');
        this._createGroup(logGroupName, (err) => {
            pino.trace('Create Group Error', err);

            if (err && err.code !== 'ResourceAlreadyExistsException') {
                // we could not create a group, so lets just bail out
                return callback(err);
            } else {
                // lets create a stream
                return this._createStream(logStreamName, logGroupName,
                  (errStream) => {
                    pino.trace('Create Stream Error', errStream);

                    if (errStream && errStream.code !==
                      'ResourceAlreadyExistsException') {
                        // we could not create a stream, so bail out
                        return callback(errStream);
                    } else {
                        // lets reset the Sequence Token
                        return this._resetSequenceToken(logGroupName,
                          logStreamName, (errReset) => {
                            pino.trace('Sequence Token Reset Error', errReset);

                            if (errReset) {
                                // we dont have any sequenceToken to
                                // work with, probably this is the 1st time this stream is being
                                // created
                                this.sequenceToken = null;
                            }
                            // these are default assignments
                            this.logGroupName = logGroupName;
                            this.logStreamName = logStreamName;
                            return callback(null);
                        });
                    }
                });
            }
        });
    }
}

module.exports = CloudWatchLogsStream;
