'use strict';

var util = require('./util');

module.exports = function Remote(options) {
    options = options || {};

    if (typeof options.name !== 'string') {
        util.fatal('no name specified for remote');
    }
    this.name = options.name;

    if (typeof options.file !== 'function') {
        util.fatal('no `file` option specified in [' + options.name + ']');
    }
    this.file = options.file.bind(this);

    if (typeof options.archive !== 'function') {
        util.fatal('no `archive` option specified in [' + options.name + ']');
    }
    this.archive = options.archive.bind(this);

    if (typeof options.archiveExt !== 'string') {
        util.fatal('no `archiveExt` option specified in [' + options.name + ']');
    }
    this.archiveExt = options.archiveExt;
};