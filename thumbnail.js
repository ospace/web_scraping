'use strict';

const fs = require('fs');
const sharp = require('sharp');

sharp.cache(false); //shart file cache disabled
/*
  Thumbnail 이미지 생성 및 저장
  예)
  let thumb = new Thumbnail("thumb1.jpg");
  fs.readdir('./', async function(err, files) {
      if(err) return;
      files.reduce((prev, each) =>{
        return prev.then(()=>thumb.append(each));
      }, Promise.resolve());
    });
 */
class Thumbnail {
    constructor(thumbName, index, unitSize, rowCount) {
        if(!thumbName) {
            throw Error("thumbName of Thumbnail constructor is required!!")
        }
        this.unitSize = unitSize || 300;
        this.rowCount = rowCount || 10;
        this.thumbName = thumbName;
        this.index = index || 0;
    }
    
    async append(filename) {
        // files.reduce((prev, each) =>{
        //     console.log('>> file:', each);
        //     return prev.then(()=>thumbImg.append(each));
        // }, Promise.resolve());

        if(this.isFull()) {
            throw Error("Thumbnail is Full"); 
        }
        
        let thumb = await this._load();
        let img = await this._loadImage(filename);
        let idx = await this._saveThumbImage(thumb, img);
        return idx;
    }
    
    isFull() {
        return this.index > this.rowCount*this.rowCount;
    }
    
    async _load() {
        if(fs.existsSync(this.thumbName)) {
            return await sharp(this.thumbName);
        } else {
            return await sharp({
                create: {
                    width: this.rowCount*this.unitSize,
                    height: this.rowCount*this.unitSize,
                    channels: 4,
                    background: {r:255, g:255, b:255}
                }
            }).jpeg();
        }
    }
    
    async _loadImage(filename) {
        return await sharp(filename)
            .resize(this.unitSize, this.unitSize, {fit:'contain', background:{r:255,g:255,b:255}})
            .toBuffer();
    }

    async _saveThumbImage(thumb, img) {
        let idx = this.index++;
        let top = parseInt(idx/this.rowCount)*this.unitSize;
        let left = parseInt(idx%this.rowCount)*this.unitSize;
        
        return new Promise((resolve, reject)=>{
            thumb
            .composite([{ input:img, top:top, left:left }])
            //.sharpen()
            .withMetadata()
            .toBuffer((err,buf)=>{
                if(err) {
                    reject(err);                    
                    return;
                }
                
                fs.writeFile(this.thumbName, buf, e=>{
                    if(e) {
                        reject(e);
                    } else {
                        resolve(idx);
                    }
                });
            });
        });
    }
}
exports = Thumbnail;
module.exports = exports;

