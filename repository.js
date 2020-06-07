//const shortid = require('shortid');
//const lodashId = require('lodash-id');
const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const util = require('./util');

/* 
자료구조
   - data: [{id:식별자, ...}]
   - thumbnails: [[id]] -  2차원 배열로 1차원은 여러 thumbnail을 지정
   - metathumbnail: [{ filename:파일명, size: 이미지크기, count: 가로/세로 개수}]

Thumbnail 재구성
   - thumbnails: [
       {filename:'파일명', size:'이미지크기', count:'가로/세로 개수', data:[데이터IDs]}
    ]
 */
class Repository {
    constructor(filename) {
        this.adapter = new FileSync(filename || 'db.json');
        this.db = lowdb(this.adapter);
        //this.db._.mixin(lodashId);
        this.db.defaults({ data: [], thumbnails: [], sequence: {} })
            .write();

        this.data = this.db.get('data');
        this.thumbnails = this.db.get('thumbnails');
    }

    insertData(item) {
        if(!item) return undefined;
        item.id = this.sequence('data');
        this.data.push(item).write();
        return item.id;
    }

    findDataBy(search) {
        return this.data.find(search).value();
    }

    findDataById(id) {
        return this.db.get('data').find({id}).value();
    }

    updateData(item) {
        this.data
               .find({id:item.id})
               .assign(item)
               .write();
    }

    deleteDataById(id) {
        this.data.remove({id}).write();
    }

    // 모든 썸네일 정보 획득
    findThumbnailAt(index) {
        let item = this.thumbnails.nth(index);
        if(!item) return null;
        return item.value();
    }

    countThumbnail() {
        return this.thumbnails.size().value();
    }

    insertThumbnailAt(index, id) {
        let item = this.thumbnails.nth(index);
        if(!item) throw Error('index out of Range');
        let value = item.value();
        value.push(id);
        item.assign(value).write();
    }

    // 새로운 Thumbnail을 추가함.
    insertThumbnail(item) {
        if(!item) return;
        item.id = this.sequence('thumbnail');
        this.thumbnails.push(item).write();
        return item.id;
    }

    updateThumbnail(item) {
        this.thumbnails
               .find({id:item.id})
               .assign(item)
               .write();
    }
    
    isFullThumbnail() {
        let len = this.metathumb.size().value();
        let meta = this.metathumb.nth(len-1);
        if(!meta) return true;
        let thumb = this.repo.thumbnails.nth(len-1);
        if(!thumb) return true;

        let count = item.value().count;
        let size = thumb.size().value();
        return size >= (count * count);
    }

    insertMetaThumbnail(filename, size, count) {
        this.metathumb
            .push({filename, size, count})
            .write();
        this.thumbnails
            .push([])
            .write();
    }

    sequence(id) {
        let seqId = `sequence.${id}`;
        let ret = this.db.get(seqId).value();
        this.db.update(seqId, n=>undefined===n?1:n+1).write();
        return undefined===ret?0:ret;
    }
}

exports = Repository;
module.exports = exports;