'use strict';

var debug = require('debug')('scrat:install:package'),
    request = require('superagent'),
    write = require('write-to'),
    mkdirp = require('mkdirp'),
    decompress = require('decompress'),
    rimraf = require('rimraf'),
    path = require('path'),
    fs = require('fs'),
    remotes = require('./remotes'),
    repoAlias = require('./alias'),
    util = require('./util'),
    empty = function () {},
    proto = Package.prototype;

function Package(repo, ref, options) {
    debug('[initialize] %s@%s', repo, ref);
    options = options || {};
    options.prefix = options.prefix || 'scrat-team';
    options.root = options.root || path.join(util.getRoot(), 'component_modules');

    this.repo = this.parseAlias(repo, options.prefix);
    this.name = this.repo.replace('/', '-');
    this.ref = this.orgiRef = (ref && ref !== '*') ? ref : 'master';
    this.root = path.resolve(options.root);

    this.remotes = ['github'].map(function (r) {
        return remotes.resolve(r);
    });
    if (Array.isArray(options.remotes)) {
        var r;
        while (r = options.remotes.pop()) {
            if (r = remotes.resolve(r)) this.remotes.unshift(r);
        }
    }

    this.manifest = null; // url of component.json
    this.archive = null;  // url of component package
    this.meta = null;     // content in component.json
    this.local = null;    // local path of component dir
    this.resFields = [    // resource fields in component.json
        'main', 'scripts', 'styles',
        'json', 'images', 'templates',
        'fonts', 'files'
    ];
}

proto.parseAlias = function (name, prefix) {
    var oldName = name;
    while (repoAlias[name] && name !== repoAlias[name]) {
        switch (util.type(repoAlias[name])) {
        case 'function':
            name = repoAlias[name](name);
            break;
        case 'string':
            name = repoAlias[name];
            break;
        }
    }
    if (prefix && name.indexOf('/') === -1) name = prefix + '/' + name;
    if (oldName !== name) {
        debug('[parseAlias] find alias for %s: %s', oldName, name);
    }
    return name;
};

proto.resolve = function () {
    var that = this,
        force, callback;
    util.each(arguments, function (arg) {
        switch (typeof arg) {
        case 'boolean':
            force = arg;
            break;
        case 'function':
            callback = arg;
            break;
        }
    });
    callback = callback || empty;
    if (this.meta && force !== true)
        return callback.call(this, null, this.meta);

    util.eachAsync(this.remotes, function (remote, done) {
        that.manifest = remote.file(that.repo, that.orgiRef, 'component.json');
        that.archive = remote.archive(that.repo, that.orgiRef);
        debug('[resolve] %s@%s from %s', that.repo, that.ref, remote.name);

        that.getMeta(force, function (err, meta) {
            if (err) {
                done.traceback.push(err);
                return done();
            }
            that.remote = remote;
            that.meta = meta;
            if (meta.version) that.ref = meta.version;
            done.result.push(meta);
            done(false);
        });
    }, function (traceback, result) {
        if (!result.length) {
            var err = new Error('failed to resolve component: ' +
                that.repo + '@' + that.ref);
            err.stack = traceback.reduce(function (stack, err) {
                return stack += '\n' + err.stack;
            }, 'Error: ' + err.message);
            return callback.call(that, err);
        }

        // set localPath if installed
        var meta = result[0];
        [that.orgiRef, that.ref].forEach(function (ref) {
            var local = path.join(that.root, that.name, ref);
            if (fs.existsSync(local)) {
                debug('[resolve] %s@%s, find local at %s', that.repo, that.ref, local);
                that.local = local;
                return false;
            }
        });
        callback.call(that, null, meta);
    });
};

proto.install = function (callback) {
    var that = this;
    callback = callback || empty;

    this.resolve(function (err) {
        if (err) return callback.call(that, err);
        if (that.local) {
            debug('[install] %s@%s had installed', that.repo, that.ref);
            return callback.call(that);
        }

        var ext = that.remote.archiveExt,
            archive = fis.project.getTempPath('install',
                'archive', that.name, that.ref),
            ball = archive + ext,
            dest = path.join(that.root, that.name, that.ref);

        debug('[install] %s@%s', that.repo, that.ref);
        if (fs.existsSync(archive)) {
            return that.trim(archive, dest, callback);
        }

        that.download(that.archive, ball, function (err) {
            if (err) return callback.call(that, err);

            var reader = fs.createReadStream(ball).on('error', done),
                writer = reader.pipe(decompress({
                    ext: ext,
                    path: archive,
                    strip: 1
                })).on('error', done).on('close', done);

            function done(err) {
                fs.unlinkSync(ball);
                reader.removeListener('error', done);
                writer.removeListener('error', done);
                writer.removeListener('close', done);
                if (err) {
                    rimraf.sync(archive);
                    return callback.call(that, err);
                }
                that.trim(archive, dest, callback);
            }
        });
    });
};

proto.getMeta = function (force, callback) {
    if (typeof force === 'function') callback = force;
    callback = callback || empty;

    var that = this,
        manifest = fis.project.getTempPath('install',
            'manifest', this.name, this.ref + '.json');

    if (force === true) {
        return this.getMetaFromUrl(this.manifest, manifest, callback);
    }

    this.getMetaFromFile(manifest, function (err, meta) {
        if (err) return callback.call(that, err);
        if (!meta) {
            debug('[getMeta] from url: %s', that.manifest);
            that.getMetaFromUrl(that.manifest, manifest, callback);
        } else {
            debug('[getMeta] from file: %s', manifest);
            callback.call(that, null, meta);
        }
    });
};

proto.getMetaFromFile = function (file, callback) {
    callback = callback || empty;
    if (!fs.existsSync(file)) return callback.call(this);

    var that = this, meta;
    fs.readFile(file, 'utf-8', function (err, json) {
        if (err) return callback.call(that, err);
        try {
            meta = JSON.parse(json);
        } catch (err) {
            return callback.call(that, err);
        }
        callback.call(that, null, meta);
    });
};

proto.getMetaFromUrl = function (url, manifest, callback) {
    callback = callback || empty;
    var that = this;
    this.download(url, manifest, function (err) {
        // TODO 出错时记录错误，不打断程序执行，最后汇总输出
        if (err) return callback.call(that, err);
        that.getMetaFromFile(manifest, callback);
    });
};

proto.download = function (url, target, callback) {
    callback = callback || empty;
    var that = this,
        req = request.get(url);
    req.set('Accept-Encoding', 'gzip');
    debug('[download] from: %s', url);
    write(req, target, function (err) {
        if (err) {
            fs.unlinkSync(target);
            return callback.call(that, err);
        }
        debug('[download] to: %s', target);
        callback.call(that);
    });
};

proto.trim = function (from, to, callback) {
    if (!this.meta) {
        return callback.call(this, new Error('component should be installed first'));
    }
    debug('[trim] from %s to %s', from, to);

    var that = this;
    this.resFields.reduce(function (files, field) {
        if (that.meta[field]) files = files.concat(that.meta[field]);
        return files;
    }, ['component.json']).forEach(function (file) {
        var dir = path.dirname(path.join(to, file));
        if (!fs.existsSync(dir)) mkdirp.sync(dir);

        fs.createReadStream(path.resolve(from, file))
            .pipe(fs.createWriteStream(path.resolve(to, file)));
    });
    callback.call(this);
};

module.exports = Package;