'use strict';

require('fis-kernel');
var path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    Package = require('../lib/package'),
    repo = 'scrat-team/event',
    ref = 'master',
    remote = 'github',
    pkg;

function clean(done) {
    exec('rm -rf component_modules component.json', done);
}

describe('Package', function () {
    before(clean);
    afterEach(clean);
    beforeEach(function () {
        fs.writeFileSync('component.json', JSON.stringify({
            repo: 'scrat-team/event',
            version: '0.1.0',
            dependencies: {
                'scrat-team/type': '0.1.0',
                'scrat-team/each': '0.1.0',
                'scrat-team/extend': '0.1.0'
            }
        }));
        pkg = new Package(repo, '*');
    });

    it('should initiate instance\'s properties', function () {
        pkg.repo.should.equal(repo);
        pkg.name.should.equal('scrat-team-event');
        pkg.orgiRef.should.equal(ref);
        pkg.ref.should.equal(ref);
        pkg.root.should.equal(path.resolve('component_modules'));
    });

    describe('#resolve()', function () {
        it('should resolve component\'s meta info', function (done) {
            pkg.resolve(function (err, meta) {
                if (err) throw err;
                meta.should.be.an.Object;
                pkg.ref.should.equal(meta.version);
                pkg.remote.name.should.equal(remote);
                pkg.manifest.should.equal('https://raw.githubusercontent.com/scrat-team/event/master/component.json');
                pkg.archive.should.equal('https://codeload.github.com/scrat-team/event/tar.gz/master');
                done();
            });
        });
    });

    describe('#install()', function () {
        it('should install a component', function (done) {
            pkg.install(function (err) {
                if (err) throw err;
                var dir = path.join(pkg.root, pkg.name, pkg.ref);
                fs.existsSync(dir).should.be.true;
                done();
            });
        });
    });
});