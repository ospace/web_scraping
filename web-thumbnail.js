'use strict';

const repository = require('./repository');
const thumbnail = require('./thumbnail');
const util = require('./util');

/*
  기본 Thumbnail 자료구조 
  * data: [] - 
  * thumbnails: [[]] -  2차원 배열로 1차원은 여러 thumbnail을 지정
  * metathumbnail: [{ filename:파일명, size: 이미지크기, count: 가로/세로 개수}]
  
  * Select: 선택 유지(storage에 저장), action 대상
  * Delete: 선택대상 삭제 처리
    - data에서 상태를 delete로 변경
    - 실제 파일은 삭제하고 나머지 정보는 유지
  * Display:
    - 현재 meta정보에서 첫번째 thumbnail을 획득, 없다면 1st
    - 선택된 thumbnails에서 대상 id 목록을 획득
    - 대상 id 목록에서 상태가 delete인 경우 선택적으로 처리
 */
//await global.thumbnail.append(id, filename);
class WebThumbnail {
    constructor(repo, size, count) {
        this.repo = repo || new repository();
        this.size = size || 200;
        this.count = count || 20;
        this.queue = [];
        
        this.thumbInfo = this.findLastThumbnail();
        if(!this.thumbInfo) {
            this.saveNewThumbnail();
        } else {
            let thumbInfo = this.thumbInfo;
            this.thumb = new thumbnail(thumbInfo.filename, thumbInfo.total, thumbInfo.size, thumbInfo.count);
        }
    }


    // 처음 로딩시 체크
    // 1.마지막 thumbnail 정보 조회
    // 1.1.정보가 없다면
    // 1.1.1.thumbnail 생성하고 저장

    // 로딩 이후에는 항상 thumbnail이 존재함.   
    // 1.2.정보가 있다면
    // 1.2.1.모두 차있다면(최대 개수와 현재 개수를 비교)
    // 1.2.1.1.thumbnail 생성하고 저장
    // 2.선택된 파일에 현 thumbnail id을 저장.
    // 3.현 thumbnail에 total을 1 증가
    append(id) {
        return new Promise(function(resolve) {
            let file = this.repo.findDataById(id);
            let ext = file.extension && file.extension.toLowerCase();
            if('.jpg'!==ext && '.png'!==ext) {
                resolve();
                return;
            }

            let isEmpty = this.isEmpty();
            this.queue.push({id, resolve});
            if(isEmpty) {
                this.run();
            }
        }.bind(this));
    }

    run() {
        if(this.isEmpty()) return;
        let job = this.queue[0];
        let file = this.repo.findDataById(job.id);

        if (this.thumbInfo.total >= this.thumbInfo.count * this.thumbInfo.count) {
            this.saveNewThumbnail();
        }

        this.repo.updateData({id:job.id, thumbId:this.thumbInfo.id, order:this.thumbInfo.total});
        this.repo.updateThumbnail({id:this.thumbInfo.id, total:++this.thumbInfo.total});
        this.thumb.append(file.filename)
        .then(()=>{
            job.resolve();
            this.queue.shift();
            if(!this.isEmpty()) this.run();
        })
        .catch((err)=>{
            util.log('[e]', err, '-', file.filename);
            job.resolve();
            this.queue.shift();
            if(!this.isEmpty()) this.run();
        });
    }

    isEmpty() {
        return 0 === this.queue.length;
    }

    saveNewThumbnail() {
        let cnt = this.repo.countThumbnail();
        let filename = `thumbnail${cnt}.jpg`;
        
        this.thumbInfo = {filename, size:this.size, count: this.count, total:0};
        this.thumbInfo.id = this.repo.insertThumbnail(this.thumbInfo);
        this.thumb = new thumbnail(filename, 0, this.size, this.count);
    }

    findLastThumbnail() {
        let cnt = this.repo.countThumbnail();
        return 0 < cnt ? this.repo.findThumbnailAt(cnt) : null;
    }
}

exports = WebThumbnail;
module.exports = exports;