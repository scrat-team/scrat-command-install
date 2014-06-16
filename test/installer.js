'use strict';

var path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    Installer = require('../lib/installer'),
    meta = {
        repo: 'scrat-team/event',
        version: '0.1.0',
        dependencies: {
            'scrat-team/type': '0.1.0',
            'scrat-team/each': '0.1.0',
            'scrat-team/extend': '0.1.0'
        }
    };

function clean(done) {
    exec('rm -rf component_modules component.json', done);
}

describe('Installer', function () {
    before(clean);
    afterEach(clean);
    beforeEach(function (done) {
        fs.writeFile('component.json', JSON.stringify(meta), done);
    });

    it('should initialize an installer', function () {
        var installer = new Installer();
        installer.meta.should.eql(meta);
    });

    describe('#calcDeps()', function () {
        it('should calculate all dependencies of components/project', function (done) {
            var installer = new Installer();
            installer.calcDeps(function (err, result) {
                if (err) throw err;
                Object.keys(result).should.length(3);
                Object.keys(result).forEach(function (k) {
                    result[k].meta.should.be.an.object;
                });
                done();
            });
        });
    });

    describe('#install()', function () {
        it('should install all components that project depends', function (done) {
            var installer = new Installer();
            installer.install(function (err) {
                if (err) throw err;
                Object.keys(meta.dependencies).forEach(function (repo) {
                    var name = repo.replace('/', '-'),
                        dir = path.join(installer.local, name);
                    fs.existsSync(dir).should.be.true;
                });
                done();
            });
        });
    });
});