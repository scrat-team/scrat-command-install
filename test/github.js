'use strict';

var remotes = require('../lib/remotes'),
    remote = remotes['github'];

describe('github', function () {
    it('should specify a file method', function () {
        remote.file.should.be.a.funciton;
        remote.file('elf/event', 'master', 'component.json')
            .should.equal('https://raw.githubusercontent.com/elf/event/master/component.json');
    });

    it('should specify an archive method', function () {
        remote.archive.should.be.a.funciton;
        remote.archive('elf/event', '0.1.0')
            .should.equal('https://codeload.github.com/elf/event/tar.gz/0.1.0');
    });

    it('should specify an archiveExt property', function () {
        remote.archiveExt.should.equal('.tar.gz');
    });
});