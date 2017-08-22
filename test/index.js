'use strict';

// external modules
const assert = require('chai').assert;
const Logger = require('../lib/index');
const CWL = require('../lib/CloudWatchLogsStream');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');

const awsFile = path.join(fs.realpathSync(__dirname),
    'awsTest.json').toString();

const opts = {
    accessKeyId: 'XXXXX',
    secretAccessKey: 'YYYYY',
    region: 'us-west-2',
    logLevel: 'trace',
    batchSize: 1,
    batchDelay: 1000,
    maxRetries: 0
};

const optsFile = {
    file: awsFile,
    logLevel: 'trace',
    batchSize: 1
};

const optsBad = {
    logLevel: 'trace',
    batchSize: 1
};

const optsRegionOnly = {
    logLevel: 'trace',
    batchSize: 1,
};

describe('cloudwatchlogger - setup', function() {
    let CWLStub = null;

    beforeEach(function(done) {
        CWLStub = {
            _createGroup: sinon.stub(CWL.prototype, '_createGroup'),
            _createStream:sinon.stub(CWL.prototype, '_createStream'),
            _resetSequenceToken:
                sinon.stub(CWL.prototype, '_resetSequenceToken'),
            _putLogs:sinon.stub(CWL.prototype, '_putLogs'),
            reset: function() {
                CWLStub._createGroup.restore();
                CWLStub._createStream.restore();
                CWLStub._resetSequenceToken.restore();
                CWLStub._putLogs.restore();
            }
        };
        CWLStub._createGroup.callsArg(1);
        CWLStub._createStream.callsArg(2);
        CWLStub._putLogs.callsArgWith(1, null, {
            sequenceToken:'1001'
        });
        CWLStub._resetSequenceToken.callsArgWith(2, null, {
            logStreams:[{ uploadSequenceToken:23123 }]
        });
        done();
    });

    it('should work if you specify AWS_PROFILE with proper keys', function(done) {
        new Logger(optsRegionOnly).setupLogger('logName', 'logStream',
            function(err, logger) {
                assert.isNotOk(err);
                assert.isOk(logger);
                assert.equal(CWLStub._createGroup.calledOnce, true);
                assert.equal(CWLStub._createStream.calledOnce, true);
                assert.equal(CWLStub._resetSequenceToken.calledOnce, true);
                assert.equal(CWLStub._putLogs.calledOnce, false);
                done();
            });
    });

    it('should setup logger', function(done) {
        new Logger(opts).setupLogger('logName', 'logStream',
            function(err, logger) {
                assert.isNotOk(err);
                assert.isOk(logger);
                assert.equal(CWLStub._createGroup.calledOnce, true);
                assert.equal(CWLStub._createStream.calledOnce, true);
                assert.equal(CWLStub._resetSequenceToken.calledOnce, true);
                assert.equal(CWLStub._putLogs.calledOnce, false);
                done();
            });
    });

    it('should setup logger from file', function(done) {
        new Logger(optsFile).setupLogger('logName', 'logStream',
            function(err, logger) {
                assert.isNotOk(err);
                assert.isOk(logger);
                assert.equal(CWLStub._createGroup.calledOnce, true);
                assert.equal(CWLStub._createStream.calledOnce, true);
                assert.equal(CWLStub._resetSequenceToken.calledOnce, true);
                assert.equal(CWLStub._putLogs.calledOnce, false);
                done();
            });
    });

    /* eslint-disable consistent-return */
    it('should throw Exception', function(done) {

        try {
            new Logger(optsBad).setupLogger('logName', 'logStream',
                function() {
                    assert.fail('Did not throw exception');
                });
        }
        catch (exceotion) {
            assert.isOk(exceotion);
            return done();
        }

    });
    /* eslint-enable consistent-return */
    afterEach(function(done) {
        CWLStub.reset();
        done();
    });
});

describe('cloudwatchlogger - simple logging', function() {
    let LoggerStub = null;
    let logger = null;
    beforeEach(function(done) {
        logger = new Logger(opts);
        LoggerStub = {
            putLogEvents: sinon.stub(logger.cwlsObject.cwLogs, 'putLogEvents'),
            createLogStream:
                sinon.stub(logger.cwlsObject.cwLogs, 'createLogStream'),
            createLogGroup:
                sinon.stub(logger.cwlsObject.cwLogs, 'createLogGroup'),
            describeLogStreams:
                sinon.stub(logger.cwlsObject.cwLogs, 'describeLogStreams'),
            reset: function() {
                LoggerStub.putLogEvents.restore();
                LoggerStub.createLogStream.restore();
                LoggerStub.createLogGroup.restore();
                LoggerStub.describeLogStreams.restore();
            }
        };
        LoggerStub.createLogGroup.callsArg(1);
        LoggerStub.createLogStream.callsArg(1);
        LoggerStub.putLogEvents.callsArgWith(1, null, {
            sequenceToken:'1001'
        });
        LoggerStub.describeLogStreams.callsArgWith(1, null, {
            logStreams:[{ uploadSequenceToken:23123 }]
        });
        done();
    });

    it('logger should post to CloudWatch < 5s', function(done) {
        this.timeout(5000);
        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isNotOk(err);
                assert.isOk(logger);
                loggerInstance.log( { ok:'bye' }, function() {
                    assert.equal(LoggerStub.putLogEvents.calledOnce, true);
                    done();
                });
            });
    });

    it('logger AWS fails to post to CloudWatch', function(done) {
        LoggerStub.putLogEvents.callsArgWith(1, { code:'Dummy Error' });

        this.timeout(5000);
        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isNotOk(err);
                assert.isOk(logger);
                loggerInstance.log( { ok:'bye' }, function(err2) {
                    assert.isOk(err2);
                    done();
                });
            });
    });

    it('logger DataAlreadyAcceptedException', function(done) {
        LoggerStub.putLogEvents.callsArgWith(1,
            { code:'DataAlreadyAcceptedException' });

        this.timeout(5000);
        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isNotOk(err);
                assert.isOk(logger);
                loggerInstance.log( { ok:'bye' }, function() {
                    assert.equal(LoggerStub.putLogEvents.calledOnce, true);
                    done();
                });
            });
    });

    afterEach(function(done) {
        LoggerStub.reset();
        done();
    });
});

describe('cloudwatchlogger - retry logging - sequence issue', function() {
    let LoggerStub = null;
    let logger = null;
    beforeEach(function(done) {
        opts.maxRetries = 2;
        logger = new Logger(opts);
        LoggerStub = {
            putLogEvents: sinon.stub(logger.cwlsObject.cwLogs, 'putLogEvents'),
            createLogStream:
                sinon.stub(logger.cwlsObject.cwLogs, 'createLogStream'),
            createLogGroup:
                sinon.stub(logger.cwlsObject.cwLogs, 'createLogGroup'),
            describeLogStreams:
                sinon.stub(logger.cwlsObject.cwLogs, 'describeLogStreams'),
            reset: function() {
                LoggerStub.putLogEvents.restore();
                LoggerStub.createLogStream.restore();
                LoggerStub.createLogGroup.restore();
                LoggerStub.describeLogStreams.restore();
            }
        };
        LoggerStub.createLogGroup.callsArg(1);
        LoggerStub.createLogStream.callsArg(1);
        LoggerStub.putLogEvents.callsArgWith(1, null, {
            sequenceToken:'1001'
        });
        LoggerStub.describeLogStreams.callsArgWith(1, null, {
            logStreams:[{ uploadSequenceToken:'23123' }]
        });
        done();
    });

    it('logger InvalidSequenceTokenException', function(done) {
        LoggerStub.putLogEvents.onFirstCall().callsArgWith(1,
            { code:'InvalidSequenceTokenException' });

        LoggerStub.putLogEvents.onSecondCall().callsArgWith(1,
            null, {
                sequenceToken:'1002'
            });

        this.timeout(5000);
        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isNotOk(err);
                assert.isOk(logger);
                loggerInstance.log( { ok:'bye' }, function() {
                    assert.equal(LoggerStub.putLogEvents.callCount, 2);
                    done();
                });
            });
    });


    it('logger InvalidSequenceTokenException - Sequence fails', function(done) {

        LoggerStub.putLogEvents.callsArgWith(1,
            { code:'InvalidSequenceTokenException' });

        LoggerStub.describeLogStreams.onFirstCall().callsArgWith(1, null, {
                logStreams: [{ uploadSequenceToken: 4006 }]
            }
        );
        LoggerStub.describeLogStreams.onSecondCall().callsArgWith(1,  {
                code: 'SomeRandomError'
            }
        );

        this.timeout(5000);
        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isNotOk(err);
                assert.isOk(logger);
                loggerInstance.log( { ok:'bye2' }, function(err2) {
                    assert.isOk(err2);
                    assert.equal(LoggerStub.putLogEvents.callCount, 2);
                    done();
                });
            });
    });

    it('logger InvalidSequenceTokenException - Sequence not present',
    function(done) {
        LoggerStub.putLogEvents.callsArgWith(1,
            { code:'InvalidSequenceTokenException' });

        LoggerStub.describeLogStreams.callsArgWith(1, null, {
                logStreams: [{ uploadSequenceToken2: '4006' }]
            }
        );

        this.timeout(5000);
        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isNotOk(err);
                assert.isOk(logger);
                loggerInstance.log( { ok:'bye2' }, function(err2, result) {
                    assert.isOk(err2);
                    assert.equal(LoggerStub.putLogEvents.callCount, 2);
                    done();
                });
            });
    });

    it('should return an error because create Group fails', function(done) {
        LoggerStub.createLogGroup.callsArgWith(1,
            { code:'RandomException' });

        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isOk(err);
                assert.isOk(loggerInstance);

                done();
            });
    });

    it('should return an error because create Stream fails', function(done) {
        LoggerStub.createLogStream.callsArgWith(1,
            { code:'RandomException' });

        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isOk(err);
                assert.isOk(loggerInstance);

                done();
            });
    });

    it('Use logger as stream', function(done) {
        const logStub =
            sinon.stub(logger.cwlsObject, 'log');
        logger.setupLogger('logName', 'logStream',
            function(err, loggerInstance) {
                assert.isNotOk(err);
                assert.isOk(loggerInstance);
                loggerInstance.getStream().write('Random Text\n');
                assert.equal(logStub.callCount, 1);
                done();
            });
    });

    afterEach(function(done) {
        LoggerStub.reset();
        done();
    });
});
