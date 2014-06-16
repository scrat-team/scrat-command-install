'use strict';

var fs = require('fs'),
    path = require('path'),
    Remote = require('./remote'),
    proto = {},
    remotes = module.exports = Object.create(proto);

proto.register = function () {
    [].slice.call(arguments).forEach(function (r) {
        remotes[r.name] = r;
    });
};

proto.resolve = function (remoteName) {
    return remotes.hasOwnProperty(remoteName) ?
        remotes[remoteName] : null;
};

// register default remotes
fs.readdirSync(path.join(__dirname, 'remotes')).forEach(function (name) {
    if (name[0] === '.') return;
    name = name.slice(0, -3);
    remotes.register(new Remote(require('./remotes/' + name)));
});