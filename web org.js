#!/usr/bin/env node
'use strict';

const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const url = require('url');
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
exports.$ = cheerio;

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
        if(3 < global.noJobCnt) {
            clearInterval(tick);
            global.workers.forEach(each=>each.stop());
        }
    }, 1000);
};
exports.done();

exports.save = function(url, filename) {
    if(!url || 'string' != typeof url) return;
    if(filename && 'string' != typeof filename) return;
    getDataEndable({url:url, headers:{'Accept':'*/*'}}, filename);
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

Connect.prototype.jsonData = function(action) {
    if('function' != typeof action) {
        throw 'invalid parameter of data - (function)';
    }

    this.patterns.push([null, function(rawData) {
        action(JSON.parse(rawData));
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
                let bar = new progressbar(select.length, {prefix:'EACH'});
                select.each(function() {
                    it[1](cheerio(this));
                    bar.increment();
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
            util.log('  ', item.state, ':', aUrl);
            return;
        } else {
            id = item.id;
        }
    } else {
        id = global.storage.save(aUrl);
    }

    let job =  workpool.newJob((end)=>{
        global.storage.changeIng(id);

        let req = new xrequest(url);
        if('function' === typeof callback) {
            xrequest.mixinString(req)
            .then(res=>{
                callback(res);
                global.storage.changeDone(id);
                end();
            })
            .catch(err=>{
                util.log('[E]', err, err.statusMessage,'[',err.statusCode, ']', url);
                global.storage.changeError(id);
                end();
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
            xrequest.mixinFile(req, filename)
            .then(res=>{
                global.storage.changeDone(id);
                await global.thumb.append(id, filename);

                end();
            })
            .catch(err=>{
                util.log('[E]', err, err.statusMessage,'[',err.statusCode, ']', url);
                global.storage.changeError(id);
                end();
            })
        }
    });
    global.workPool.push(job);
};

/*
function getDataEndable(my_url, cb) {
    let job =  util.Worker.newJob((end)=>{
        //try {
            getData(my_url, cb, function(e, msg) {
                switch(e) {
                case 'init':
                    //console.log('[ ]', (msg));
                    break;
                case 'begin':
                    //console.log('[.]', my_url, '-', msg);
                    break;
                case 'end':
                    end();
                    //console.log('[F]', (msg));
                    break;
                case 'redirect':
                    //--cocurrent_conn;
                    //console.log('[>]', my_url, '>', msg);
                    getDataEndable(msg, cb);
                    break;
                case 'error':
                    //end();
                    util.log('[E]', e, msg);
                    //err = e;
                    break;
                }
            });
        //} catch(ex) {
        //    util.log('[E]', ex);
        //    end();
        //}
    });

    global.workPool.push(job);
}
*/
//ref: https://www.npmjs.com/package/request
exports.getData = getData;
function getData(setting, param, handler) {
    let opts = create_header(setting);
    let my_url = opts.uri;

    let bar = null;
    let recv_length = 0;

    let file_name = util.createFilename(my_url, param);
    let req = null;
    try {
        req = request(opts);
    } catch(ex) {
        if(handler) handler('error', my_url+' - '+ex.message);
        return;
    }

    req.on('error', function(err) {
        if(handler) handler('error', my_url+' - '+err);
    }).on('redirect', function(res) {
        req.abort();
        let redirectUri = this.response.headers.location;
        if(handler) handler('redirect', redirectUri);
    }).on('response', function(res) {
        if(handler) handler('begin', res.statusCode);
        switch(res.statusCode) {
        case 302:
            req.abort();
            if(handler) handler('redirect', res.Location+' > '+res.redirectUri);
            break;
        //case 303:
        //    break;
        default:
            if(200 != res.statusCode) {
                req.abort();
                if(handler) handler('error', my_url+' - '+res.statusMessage+'('+res.statusCode+')');
                return;
            }
            break;
        }

        if (res.headers) {
            let content_length = res.headers['content-length'];
            if (content_length) {
                //if(handler) handler('init', {url:my_url, 'content-length':content_length});
                bar = new progressbar(content_length, Object.assign({prefix:'FILE'}, barOptions));
            }
            var cookie = res.headers['set-cookie'];
            if(cookie) {
                setCookie(cookie);
            }
        }

        if(util.isFunc(param)) {
            this.buf = '';
        }
    }).on('end', function(data) {
        if(!file_name) {
            if(!this.buf) {
                if(handler) {
                    handler('error', my_url+' - body emtpy');
                    handler('end', my_url);
                }
                return;
            }
            param(this.buf);
        }

        if(handler) handler('end', my_url+(file_name?' > '+file_name:''));
    }).on('data', function(body) {
        if(!file_name) {
            this.buf += body;
        }

        //if(handler) handler('data', body.length);
        if(bar) bar.update(body.length, {desc:my_url});
    });

    if(file_name) {
        if(fs.existsSync(file_name)) {
            let status = fs.statSync(file_name);
            if(0 < status.size) {
                req.abort();
                if(handler) {
                    handler('error', my_url+' - '+file_name+' is existed');
                    handler('end', my_url);
                }
                return;
            }
        }

        let f = fs.createWriteStream(file_name).on('error', function(err) {
            if(handler) handler('error', my_url+' - '+err);
        });
        req.pipe(f);
    }

    req.end();
}

function appendData(setting, param, handler) {
    let opts = create_header(setting);
    let my_url = opts.url;

    if(handler) handler('init', my_url);

    // if(opts['error']) {
    //     if(handler) handler('error', opts.error);
    //     return;
    // }
    let bar = null;
    let recv_length    = 0;

    let file_name = createFilename(my_url, param);
    let req = request(opts);

    req.on('error', function(err) {
        if(handler) handler('error', my_url+' - '+err);
    }).on('redirect', function(res) {
        req.abort();
        let redirectUri = this.response.headers.location;
        if(handler) handler('redirect', redirectUri);
    }).on('response', function(res) {
        if(handler) handler('begin', my_url);
        
        switch(res.statusCode) {
        case 302:
            req.abort();
            if(handler) handler('redirect', res.Location+' > '+res.redirectUri);
            break;
        //case 303:
        //    break;
        default:
            if(200 != res.statusCode) {
                req.abort();
                if(handler) handler('error', my_url+' - '+res.statusMessage+'('+res.statusCode+')');
                return;
            }
            break;
        }

        if (res.headers) {
            content_length = res.headers['content-length'];
            if (content_length) {
                //if(handler) handler('init', {url:my_url, 'content-length':content-length});
                bar = new progressbar(content_length, {prefix:'FILE'});
            }
            var cookie = res.headers['set-cookie'];
            if(cookie) {
                setCookie(cookie);
            }
        }

        if(isFunc(param)) {
            this.buf = '';
        }
        // compressed data as it it received
        //res.on('data', function(data) {
        //});
    }).on('end', function(data) {
        if(!file_name) {
            if(!this.buf) {
                if(handler) {
                    handler('error', my_url+' - body emtpy');
                    handler('end', my_url);
                }
                return;
            }
            param(this.buf);
        }

        if(handler) handler('end', my_url+(file_name?' > '+file_name:''));
    }).on('data', function(body) {
        if(!file_name) {
            this.buf += body;
        }

        if(bar) bar.update(body.length, {desc:my_url});
        //if(handler) handler('data', body.length);
    });

    if(file_name) {
        let f = fs.createWriteStream(file_name, {flags:'a+', 'encoding':null}).on('error', function(err) {
            if(handler) handler('error', my_url+' - '+err);
        });
        req.pipe(f);
    }

    req.end();
}

const port = { ftp: 32, gopher: 70, http: 80, https: 443, ws: 80, wws:  443 };
function create_header(setting) {
    
    var opts = {
        rejectUnauthorized:false,
        //followAllRedirects: true,
        headers: {
            //'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:58.0) Gecko/20100101 Firefox/58.0',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36',
            'Cache-Control': 'no-cache',
            'Accept': '*/*',
            //'Accept-Encoding': 'deflate',
            'Accept-Encoding': 'gzip,deflate,br',
            //'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
            //Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            //Accept:'text/html'
        }
    };
    
    if('string' === typeof setting) {
        opts.uri = encodeURI(setting);
        opts.url = setting;
    } else {
        opts = Object.assign(opts, setting);
        opts.uri = encodeURI(opts.url);
    }
    
    if(!opts.headers.Accept) {
        var filename = util.filenameOfUrl(opts.url);
        opts.headers['Accept'] = opts.Accept || create_accept(util.getExtention(filename));
    }
    
    var _url = new url.parse(opts.url);
    var _port = _url.port;

    if(!_port) {
        switch(_url.protocol) {
        case 'https:': _port = 443; break;
        case 'http:': _port = 80; break;
        default: _port=80; break;
        }
    }
    opts.hostname = _url.hostname;
    opts.port = _port;
    opts.path = _url.path;
    
    if(!opts.headers.Host) {
        opts.headers['Host'] = _url.hostname;
    }
    
    return opts;
}

function create_accept(type) {
    //if(!type) return 'text/html';
    
    switch(type) {
    case 'jpg': case 'jpeg':
        return 'image/*';
    }
    
    return 'text/html,*/*';
}

function getCookie() {
    return Object.entries(g_cookies).map(it=>`${it[0]}=${it[1]}`).join(';');
}

function setCookie(cookie) {
    for(var i=0; i<cookie.length; ++i) {
        var item = cookie[i].split(';')[0].split('=');
        g_cookies[item[0]] = item[1];
    }
}
