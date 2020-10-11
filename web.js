#!/usr/bin/env node
'use strict';

//const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
//const url = require('url');
const util = require('./util');
const progressbar = require('./progress-bar');
const workpool = require('./workpool');
const repository = require('./repository');
const webstorage = require('./web-storage');
const xrequest = require('./xrequest');
const webThumbnail = require('./web-thumbnail');
//require('ansi')(process.stdout);

//oauth
//https://github.com/request/request
//Cloudflare Block

//https://github.com/goblinfactory/konsole

const stream = process.stdout;
var g_cookies = {};

exports.cheerio = cheerio;

var cocurrent_conn = 0;
const MAX_CONN = 3;

var global = {};
global.workPool = new workpool();
global.workers = [];
global.noJobCnt = 0;

global.repo = new repository();
global.storage = new webstorage(global.repo);
global.thumb = new webThumbnail(global.repo);

for(let i=0; i<MAX_CONN; ++i) {
    let w = new workpool.worker(global.workPool);
    global.workers.push(w);
    w.run();
}

util.log('worker initialized:', global.workers.length, 'ea');

/*
 종료시점 정하는 문제
 * 중간에 pool이 비어있는 상태에서 모든 worker가 오랜동안 작업 중이라면 pool 비어있는 시간은 증가됨.
 * worker잡이 종료되어야 다른 job을 추가하는 과정이 실행될 수 있음.
 */
exports.done = function() {
    let tick = setInterval(()=>{
        if (global.workPool.empty()) {
            ++global.noJobCnt;
        } else {
            global.noJobCnt = 0;
        }
        if(8 < global.noJobCnt) {
            clearInterval(tick);
            global.workers.forEach(each=>each.stop());
        }
    }, 1000);
};
exports.done();

exports.save = function(aUrl, filename) {
    if(!aUrl || 'string' != typeof aUrl) return;
    
    if(!filename || filename && 'string' != typeof filename) {
        filename = util.filenameOfUrl(aUrl)
    }
    
    if(fs.existsSync(filename)) {
        util.log('[s] existed', filename);
        return;
    }
    
    return getDataEndable({url:aUrl, headers:{'Accept':'*/*'}}, filename);
}

exports.append = function(aUrl, filename) {
    if(!aUrl || 'string' != typeof aUrl) return;
    
    if(!filename || filename && 'string' != typeof filename) {
        filename = util.filenameOfUrl(aUrl)
    }
    
    return getDataEndable({url:aUrl, headers:{'Accept':'*/*'}}, filename);
}

// https://github.com/mafintosh/download-m3u8/blob/master/index.js

//     if(!url || 'string' != typeof url) return;
//     return dataLimit(url, appendData, filename);
// }

exports.open = function(url) {
    return new Connect(url);
};

function Connect(url) { 
    this.url = url;
    this.patterns = [];
}

Connect.prototype.iterate = function(pattern, action) {
    if('string' != typeof pattern || 'function' != typeof action) {
        throw 'invalid parameter of iterate - (string, function)'
    }
    this.patterns.push([pattern, action]);

    return this;
}

Connect.prototype.iterateSave = function(pattern, action) {
    if('string' != typeof pattern || 'function' != typeof action) {
        throw 'invalid parameter of iterate - (string, function)';
    }

    this.patterns.push([pattern, it=>{
        let res = action(it);
        if(!res) return;
        let url = 'string' === typeof res ? res : res.url;
        let filename = 'string' === typeof res ? null : res.filename;
        if(!filename) {
            filename = util.filenameOfUrl(url);
        }
        getDataEndable({url:url, headers:{'Accept':'*/*'}}, filename);
    }]);

    return this;
}

Connect.prototype.data = function(action) {
    if('function' != typeof action) {
        throw 'invalid parameter of data - (function)';
    }

    this.patterns.push([null, action]);
    return this;
}

Connect.prototype.domData = function(action) {
    if('function' != typeof action) {
        throw 'invalid parameter of data - (function)';
    }

    this.patterns.push([null, function(rawData) {
        action(cheerio.load(rawData));
    }]);
    return this;
}

Connect.prototype.jsonData = function(action) {
    if('function' != typeof action) {
        throw 'invalid parameter of data - (function)';
    }

    this.patterns.push([null, function(rawData) {
        let json = JSON.parse(rawData);
        action(json);
    }]);
    return this;
}

Connect.prototype.run = function() {
    if(!this.url) {
        //console.error('[E]', 'invalid url - EMPTY');
        return;
    }

    let url = this.url;
    getDataEndable(url, (data) => {
		let $ = cheerio.load(data);
        this.patterns.forEach(it=>{
            let pattern = it[0];
            if (pattern) {
                let select = $(pattern);
                if (undefined === select || 0 == select.length) {
                    return;
                }
                //let bar = new progressbar(select.length, {prefix:'EACH'});
                select.each(function() {
                    it[1](cheerio(this));
                    //bar.increment();
                });
            } else {
                it[1](data);
            }
        });
	});
}

exports.getJson = function(aUrl) {
    var headers = {
        "Content-Type":"application/json; charset=utf-8",
        "X-Request":"JSON",
        "X-Requested-With":"XMLHttpRequest"
    };
    
    if('string' != typeof(aUrl)) {
        headers = Object.assign(headers, aUrl.headers);    
        aUrl = aUrl.url;
    }

    return new Promise((resolve, reject)=>{
        getDataEndable({method:'GET', url:aUrl, headers:headers}, (data) => {
            resolve(JSON.parse(data));
        });
    });
}

function getDataEndable(url, callback) {
    let aUrl = 'string'===typeof url ? url : url.url;

    /*
    1.URL이 상태 정보 획득
    1.1.상태가 done 또는 error인 경우 종료
    1.2.상태가 init또는 ing인 경우 진행
    2.상태 값을 ing 상태로 변경
    */
    let item = global.storage.getItem(aUrl);
    let id = null;
    if(item) {
        if('done' === item.state || 'error' === item.state) {
            util.log('[S]', global.workPool.length(), item.state, '-', aUrl);
            return;
        } else {
            id = item.id;
        }
    } else {
        id = global.storage.save(aUrl, callback);
    }
    
    return new Promise(function(resolve, reject) {

        let job =  workpool.newJob((end)=>{
            global.storage.changeIng(id);

            let req = new xrequest(url);
            if('function' === typeof callback) {
                util.log('[.]', global.workPool.length(), 'string'===typeof url?url:url.url);
                xrequest.mixinString(req)
                .then(res=>{
                    callback(res);
                    end();
                    resolve();
                })
                .catch(err=>{
                    console.log('Error in mixinString:', err);
                    switch(err.statusCode) {
                    case 301: case 302:
                        util.log('[>]', url, '->', err.location);
                        getDataEndable(err.location, callback);
                        break;
                    default:
                        util.log('[E1]', err, url);
                        global.storage.changeError(id);
                        break;
                    }
                    end();
                    reject();
                })
            } else {
                /*
                 파일 저장이 완료되고 해당 id획득하고, Thumbnail로 저장
                 1.현재 Thumbnail이 모두 사용되었는지 확인
                 1.1.모두 사용중이면
                 1.1.2.새로운 Thumbnail을 생성하고 Thumbnail 목록에 추가함.
                 1.2.현재 Thumbnail에 파일 추가하고 index값 획득
                 1.3.현재 Thumbnail 정보에 해당 파일 인덱스 파일에 id값 저장
                 */
                xrequest.mixinBar(req);

                let filename = callback;
                xrequest.mixinFile(req, filename)
                .then(res=>{
                    global.storage.changeDone(id);
                    global.thumb.append(id)
                    .then(()=>{
                        end();
                        resolve();
                    })
                    .catch((err)=>{
                        util.log('[e]', err, '-', filename);
                        end();
                        reject();
                    });

                })
                .catch(err=>{
                    console.log('Error in mixinFile:', err);
                    util.log('[E2]', err, url);
                    global.storage.changeError(id);
                    end();
                    reject();
                })
            }
        });
        global.workPool.push(job);
    });
};