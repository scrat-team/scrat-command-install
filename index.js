'use strict';

var util = require('./lib/util'),
    Installer = require('./lib/installer');

exports.name = 'install';
exports.usage = '[name] [options]';
exports.desc = 'install component modules';
exports.register = function (commander){
    commander
        .option('-S, --no-save', 'not save dependencies into json file', Boolean)
        .option('-c, --clean', 'clean install cache', Boolean)
        .action(function () {
            var installer = new Installer(),
                args = Array.prototype.slice.call(arguments),
                options = args.pop(),
                repo = args.shift();

            if (options.clean) Installer.clean();

            if (repo) {
                args = repo.split('@');
                if (options.save) args.push(true);
            } else {
                args = [];
            }
            args.push(function (err) {
                if (err) util.fatal(err);
            });
            installer.install.apply(installer, args);
        });
};