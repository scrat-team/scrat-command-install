'use strict';

var debug = require('debug')('scrat:install:installer'),
    semver = require('semver'),
    rimraf = require('rimraf'),
    path = require('path'),
    fs = require('fs'),
    Package = require('./package'),
    util = require('./util'),
    empty = function () {},
    proto = Installer.prototype;

Installer.remotes = require('./remotes');
Installer.clean = function () {
    rimraf.sync(fis.project.getTempPath('install'));
};

function Installer() {
    this.depFields = ['dependencies'];
    this.manifest = path.join(util.getRoot() || process.cwd(), 'component.json');
    if (!this.manifest || !fs.existsSync(this.manifest)) {
        util.fatal(new Error('cannot find a `component.json` file'));
    }

    this.meta = JSON.parse(fs.readFileSync(this.manifest, 'utf-8') || '{}');
    this.local = path.join(util.getRoot(), 'component_modules');
    this.remotes = ['github'].map(Installer.remotes.resolve);
    debug('[initialize] %s@%s', this.meta.name, this.meta.version);
}

proto.calcDeps = function (packages, callback, result) {
    if (typeof packages === 'function') {
        result = callback;
        callback = packages;
        packages = Object.create(Package.prototype);
        packages.repo = '-';
        packages.meta = this.meta;
    }

    if (!Array.isArray(packages)) packages = [packages];
    callback = callback || empty;
    result = result || {};

    var that = this;
    util.eachAsync(packages, function (pkg, done) {
        if (pkg.meta) return done();
        if (!pkg.repo || !pkg.ref) util.fatal('invalid component');

        // resolve each component if not resolving or resolved
        debug('[calcDeps] resolve %s@%s', pkg.repo, pkg.ref);
        var local = path.join(that.local, pkg.name, pkg.ref),
            manifest = path.join(local, 'component.json');
        if (fs.existsSync(manifest)) {
            pkg.getMetaFromFile(manifest, function (err, meta) {
                if (err) done.traceback.push(err);
                else {
                    pkg.local = local;
                    pkg.meta = meta;
                }
                debug('[calcDeps] %s@%s found at local', pkg.repo, pkg.ref);
                done();
            });
        } else {
            pkg.resolve(!semver.valid(pkg.ref), function (err) {
                if (err) done.traceback.push(err);
                done();
            });
        }
    }, function (traceback) {
        if (traceback.length) {
            var err = new Error('failed to resolve components');
            err.stack = traceback.reduce(function (stack, err) {
                return stack += '\n' + err.stack;
            }, 'Error: ' + err.message);
            return callback.call(that, err);
        }

        // process dependencies
        util.eachAsync(packages, function (pkg, done) {
            var deps = that.depFields.reduce(function (deps, field) {
                util.each(pkg.meta[field], function (ref, repo) {
                    deps.push(new Package(repo, ref));
                });
                return deps;
            }, []);

            debug('[calcDeps] %s@%s - %o', pkg.repo, pkg.ref,
            deps.map(function (pkg) { return pkg.repo + '@' + pkg.ref; }));
            that.calcDeps(deps, function (err, result) {
                if (err) {
                    done.traceback.push(err);
                    return done();
                }
                var existsPkg = result[pkg.repo];
                if (pkg.repo !== '-') {
                    if (!existsPkg ||                        // if not exists
                        semver.valid(existsPkg.ref) &&       // or existsPkg isn't */master
                        semver.lt(existsPkg.ref, pkg.ref) || // and pkg is newer
                        !semver.valid(pkg.ref)) {            // or pkg is */master
                        result[pkg.repo] = pkg;              // then replace existsPkg
                    }
                }
                done();
            }, result);
        }, function (traceback) {
            if (traceback.length) {
                var err = new Error('failed to calculate dependencies');
                err.stack = traceback.reduce(function (stack, err) {
                    return stack += '\n' + err.stack;
                }, 'Error: ' + err.message);
                return callback.call(that, err);
            }
            callback.call(that, null, result);
        });
    });
};

proto.install = function () {
    var that = this, pkg,
        repo, ref, save, callback;
    util.each(arguments, function (arg) {
        switch (typeof arg) {
        case 'string':
            if (!repo) repo = arg;
            else if (!ref) ref = arg;
            break;
        case 'boolean':
            save = arg;
            break;
        case 'function':
            callback = arg;
            break;
        }
    });
    ref = ref || '*';
    callback = callback || empty;

    util.log('install', 'preparing...')
    if (repo && ref) {
        pkg = new Package(repo, ref);
        this.calcDeps(pkg, function (err, result) {
            if (err) return callback.call(that, err);

            var existsPkg = result[pkg.repo];
            if (existsPkg && existsPkg.ref !== pkg.ref) result[pkg.repo] = pkg;

            var callbackBak = callback;
            callback = function (err) {
                callbackBak.call(that, err);
                if (!err && save) {
                    that.depFields.forEach(function (field) {
                        that.meta[field] = that.meta[field] || {};
                        delete that.meta[field][pkg.repo];
                    });
                    that.meta.dependencies[pkg.repo] = pkg.ref;
                    debug('[install] write back component.json: %s@%s', pkg.repo, pkg.ref);
                    fs.writeFile(that.manifest,
                        JSON.stringify(that.meta, null, '  '), function (err) {
                        if (err) {
                            util.error('install',
                                'failed to write back to component.json\n' + err.stack);
                        }
                    });
                }
            };
            processor(err, result);
        });
    } else {
        this.calcDeps(processor);
    }

    function processor(err, result) {
        if (err) return callback.call(that, err);
        util.eachAsync(result, function (pkg, done) {
            // pass if installed
            if (pkg.local) return done();

            util.log('install', 'installing ' + pkg.repo + '@' + pkg.ref + '...');
            pkg.install(function (err) {
                if (err) done.traceback.push(err);
                done();
            });
        }, function (traceback) {
            if (traceback.length) {
                var err = new Error('failed to install components');
                err.stack = traceback.reduce(function (stack, err) {
                    return stack += '\n' + err.stack;
                }, 'Error: ' + err.message);
                return callback.call(that, err);
            }
            callback.call(that, null);
            util.log('install', 'finished');
        });
    }
};

module.exports = Installer;