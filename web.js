#!/usr/bin/env node
'use strict';

const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const util = require('./util');
const progressbar = require('./progress-bar');
const workpool = require('./workpool');
const repository = require('./repository');
const webstorage = require('./web-storage');
const xrequest = require('./xrequest');
const webThumbnail = require('./web-thumbnail');

//oauth
//https://github.com/request/request
//Cloudflare Block

//https://github.com/goblinfactory/konsole

const stream = process.stdout;
var g_cookies = {};

exports.cheerio = cheerio;

var cocurrent_conn = 0;
const MAX_CONN = 3;

var global = {
    retryMax: 200
};

initWorkPool();
function initWorkPool() {
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
}

function isRunning() {
    for(let i=0; i<MAX_CONN; ++i) {
        let w = global.workers[i];
        if(w.isRunning()) return true;
    }
    
    return false;
}

function runningCount() {
    var ret = 0;
    for(let i=0; i<MAX_CONN; ++i) {
        let w = global.workers[i];
        if(w.isRunning()) ++ret;
    }
    
    return ret;
}

/*
 종료시점 정하는 문제
 * 중간에 pool이 비어있는 상태에서 모든 worker가 오랜동안 작업 중이라면 pool 비어있는 시간은 증가됨.
 * worker잡이 종료되어야 다른 job을 추가하는 과정이 실행될 수 있음.
 */
exports.done = function() {
    let tick = setInterval(()=>{
        
        if (!isRunning()) {
            ++global.noJobCnt;
        } else {
            global.noJobCnt = 0;
        }
        
        if(3 < global.noJobCnt) {
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

exports.saveImage = function(aUrl, filename) {
    if(!aUrl || 'string' != typeof aUrl) return;
    
    if(!filename || filename && 'string' != typeof filename) {
        filename = util.filenameOfUrl(aUrl)
    }
    
    if(fs.existsSync(filename)) {
        util.log('[s] existed', filename);
        return;
    }
    
    return getDataEndable({url:aUrl, headers:{'Accept':'image/avif,image/webp,*/*', 'Sec-Fetch-Dest':'image'}}, filename);
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

function getDataEndable(options, callback) {
    let aUrl = 'string'===typeof options ? options : options.url;
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
        
    return pushJob(res=>{
        /*
        1.URL이 상태 정보 획득
        1.1.상태가 done 또는 error인 경우 종료
        1.2.상태가 init또는 ing인 경우 진행
        2.상태 값을 ing 상태로 변경
        */
        global.storage.changeIng(id);
        //let req = new xrequest(aUrl);
        let req = new xrequest(options);
        
        if('function' === typeof callback) {
            util.log('[.]', runningCount(), aUrl);
            return xrequest.mixinString(req)
            .then(({body})=>{
                callback(body);
                //return Promise.resolve();
                return body;
            })
            /*
            .catch(({type, error})=>{
                util.log('[E1]', type, error);
                
                if(-4077 === error.errno) {
                    throw {type, error};
                }
            });
            */
            .catch(err=>{
                util.log('[E1] ' + err);
                
                if(err && err.error && -4077 === err.error.errno) {
                    throw err;
                }
            });
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
            return xrequest.mixinFile(req, filename)
            .then(res=>{
                global.storage.changeDone(id);
                global.thumb.append(id)
                .catch(err=>{
                    //util.log('[E2]', err);
                });
            })
            .catch(err=>{
                util.log('[E2] ' + err); 
                if(err && err.error) {
                    if('TIMEOUT' === err.error.code) {
                        fn.unlinkSync(filename);
                    } else if(301 === err.error.statusCode) {
                        // err.error.headers.location 에서 찾을 수 있음.
                        return;
                    }
                    
                    throw err;
                }
            });
        }
    });
};

exports.postForm = postForm;
function postForm(url, data, retry=global.retryMax) {
    return pushJob(res=>{
        return new Promise(function(resolve, reject) {
            util.log("[.]", url);
            request.post({
                url: url,
                form: data,
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36',
                    'Content-Type' : 'multipart/form-data' 
                },
                method: 'POST'
            }, function(err, data) {
                err ? reject(err) : resolve(data && data.body);
            });
        });
    });
}

exports.pushJob = pushJob;
function pushJob(fn) {
    return new Promise(function(resolve, reject) {
        let job =  workpool.newJob(end=>{
            util.retry(fn, global.retryMax)
                .then(res=>{
                    resolve(res);
                    end();
                })
                .catch(err=>{
                    util.log('[E]', err);
                    reject(err);
                    end();
                });
        });
        global.workPool.push(job);
    });
}
