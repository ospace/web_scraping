#!/usr/bin/env node
'use strict';

const assert = require('assert');
const request = require('request');
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
const FormData = require('form-data');
//require('ansi')(process.stdout);

//oauth
//https://github.com/request/request
//Cloudflare Block

//https://github.com/goblinfactory/konsole

const stream = process.stdout;

var global = {
    MAX_CONN: 3,
    workPool: new workpool(),
    workers: [],
    noJobCnt: 0,
    repo: new repository(),
    storage: new webstorage(this.repo),
    thumb: new webThumbnail(this.repo)
};

(function() {
    for(let i=0; i<global.MAX_CONN; ++i) {
        let w = new workpool.worker(global.workPool);
        global.workers.push(w);
        w.run();
    }
    
    util.log('worker initialized:', global.workers.length, 'ea');
    
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
})();

function isRunning() {
    for(let i=0, n=global.workers.length; i<n; ++i) {
        let w = global.workers[i];
        if(w.isRunning()) return true;
    }
    
    return false;
}

function runningCount() {
    let ret = 0;
    for(let i=0, n=global.workers.length; i<n; ++i) {
        let w = global.workers[i];
        if(w.isRunning()) ++ret;
    }
    
    return ret;
}

exports.open = function(urlStr, options) {
    if('object' ===  typeof urlStr) {
        options = urlStr;
        urlStr = options.url;
    }
    
    options = Object.assign({
        retry: 1
    }, options);
    
    return pushJob(_=>{
        util.log('[.]', urlStr);
        let req = new xrequest(urlStr, options);
        return xrequest.mixinString(req)
            .then(({header, body})=>{
                return new Response(urlStr, body, header);
            })
            .catch(err=>{
                util.log('[E1]', err);
                throw err;
            });
    }, options.retry);
}

/*
exports.postForm = function(urlStr, param, options) {
    let formData = new FormData();
    for(let k in param) {
        formData.append(k, param[k]);
    }
    
    options = Object.assign({
        url: urlStr,
        method: 'POST',
        data: formData,
    }, options);
    
    return exports.open(options);
}
*/

exports.postForm = function(urlStr, data, options) {
    options = Object.assign({
        retry: 1
    }, options);
    
    return pushJob(_=>{
        util.log('[.]', urlStr);
        
        return new Promise((resolve, reject)=>{
            request.post({
                url: urlStr,
                form: data,
                method: 'POST'
            }, function(err, res) {
                if(err) {
                    util.log('[E2]', err);
                    reject(err);
                    /*
                    if(-4077 === err.errno) {
                        throw err;
                    } else {
                        reject(err);
                    }
                    */
                } else {
                    resolve(new Response(urlStr, res.body, {
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers
                    }));
                }
            });
        });
    }, options.retry);
}

exports.save = function(urlStr, filepath, options) {
    if (!filepath || 'object' === typeof filepath) {
        options = filepath;
        filepath = util.filenameOfUrl(urlStr);
    }
    
    options = Object.assign({
        retry: 1
    }, options);
    
    return pushJob(_=>{
        if(!options.appendFile && fs.existsSync(filepath)) {
            util.log('[s] existed', filepath);
            return Promise.resolve();
        }
    
        let req = new xrequest(urlStr, options);
        xrequest.mixinBar(req);
        return xrequest.mixinFile(req, filepath)
            .catch(err=>{
                util.log('[E2] ' + err); 
                if(err && err.error && 'TIMEOUT' === err.error.code) {
                    fs.unlinkSync(filepath);
                    throw err;
                }
            });
    }, options.retry);
}

function Response(url, body, init) {
    this.url = url;
    this.body = body;
    this.status = init && init.status;
    this.statusText = init && init.statusText;
    this.headers = (init && init.headers) || {};
}

Response.prototype = Object.assign(Response.prototype, {
    json: function() {
        return this.body && JSON.parse(util.removeByteOrder(this.body));
    },
    select: function(pattern) {
        assert(this.body, 'null body');
        
        let $ = this.$ || (this.$ = cheerio.load(this.body));
    
        return this.$(pattern).map(function() {
            return $(this);
        }).get();
    },
    regex: function(re) {
        assert(this.body, 'null body');
        assert(re, 'null regex');
            
        let ret = [];
        let val;
        while(val = re.exec(this.body)) {
            ret.push(val);
        }
        
        return ret;
    },
    m3u8: function() {
        assert(this.body, 'null body');
        
        return util.parseM3u8(this.body);
    },
    ok: function() {
        return 200 === this.status;
    }
});

function pushJob(fn, retryCnt) {
    return new Promise(function(resolve, reject) {
        let job =  workpool.newJob(end=>{
            util.retry(fn, retryCnt)
                .then(res=>{
                    resolve(res);
                    end();
                })
                .catch(err=>{
                    util.log('[E] ' + err);
                    reject(err);
                    end();
                });
        });
        global.workPool.push(job);
    });
}