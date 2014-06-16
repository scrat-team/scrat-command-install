'use strict';

module.exports = {
    name: 'github',
    file: function (repo, ref, path) {
        return 'https://raw.githubusercontent.com/' + repo + '/' + ref + '/' + path;
    },
    archiveExt: '.tar.gz',
    archive: function (repo, ref) {
        return 'https://codeload.github.com/' + repo + '/tar.gz/' + ref;
    }
};