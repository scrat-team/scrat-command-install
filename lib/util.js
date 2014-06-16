'use strict';

var fs = require('fs'),
    path = require('path'),
    colors = require('colors');

exports.type = function (obj) {
    var t;
    if (obj == null) {
        t = String(obj);
    } else {
        t = Object.prototype.toString.call(obj).toLowerCase();
        t = t.substring(8, t.length - 1);
    }
    return t;
};

exports.each = function (obj, iterator, context) {
    if (typeof obj !== 'object') return;

    var i, l, t = exports.type(obj);
    context = context || obj;
    if (t === 'array' || t === 'arguments' || t === 'nodelist') {
        for (i = 0, l = obj.length; i < l; i++) {
            if (iterator.call(context, obj[i], i, obj) === false) return;
        }
    } else {
        for (i in obj) {
            if (obj.hasOwnProperty(i)) {
                if (iterator.call(context, obj[i], i, obj) === false) return;
            }
        }
    }
};

exports.eachAsync = function (obj, iterator, callback, context) {
    var queue = [];
    exports.each(obj, function (value, key) {
        queue.push({
            key: key,
            value: value
        });
    });

    function done(next) {
        var item = queue.shift(),
            args;
        if (!item || next === false) {
            return callback.call(context, done.traceback, done.result);
        }
        args = [item.value, item.key, obj].slice(0, iterator.length - 1);
        args.push(done);
        iterator.apply(context, args);
    }
    done.traceback = [];
    done.result = [];
    done();
};

exports.getRoot = function (from) {
    from = path.resolve(from || process.cwd());
    if (fs.existsSync(path.join(from, 'component.json'))) return path.resolve(from);
    if (path.dirname(from) === from) return null;
    return exports.getRoot(path.dirname(from));
};

exports.log = function (type, msg, color) {
    color = color || 'grey';
    var pad = Array(Math.max(0, 10 - type.length) + 1).join(' '),
        m = type === 'warn' || type === 'error' ? type : 'log';
    console[m]((pad + type).green, msg[color]);
};

exports.warn = function (msg) {
    exports.log('warn', msg, 'yellow');
};

exports.error = function (msg) {
    exports.log('error', msg, 'red');
};

exports.fatal = function (err) {
    if (typeof err === 'string') err = new Error(err);
    exports.error(err.stack);
    process.exit(1);
};