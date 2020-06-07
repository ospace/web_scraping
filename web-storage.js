const repository = require('./repository');
const util = require('./util');

class WebStorage {
    constructor(repo) {
        this.repo = repo || new repository();
    }

    save(url, filename) {
        //기존에 url이 있는지 확인
        let res = this.getItem(url);
        if(res) return res.id;
        
        let item = this.createItem(url);
        if('string' === typeof filename) {
            item.filename = filename;
        }
        return this.repo.insertData(item);
    }

    createItem(url) {
        let filename = util.filenameOf(url);
        let extension = util.extentionOf(url);
        let state = WebStorage.INIT;
        return { url, filename, extension, state };
    }

    changeDone(id) {
        let item = this.repo.findDataById(id);
        this.repo.updateData({ id, state:WebStorage.DONE });
        if(item && item.filename) {
        }
    }

    changeError(id) {
        this.repo.updateData({id, state:WebStorage.ERROR });
    }

    changeIng(id) {
        this.repo.updateData({id:id, state:WebStorage.ING });
    }

    getItem(url) {
        return this.repo.findDataBy({url});
    }
}
Object.assign(WebStorage, { INIT:'init', ING:'ing', ERROR:'error', DONE:'done' });

exports = WebStorage;
module.exports = exports;
