'use strict';

const https = require('https');
const http = require('http');
//const http2 = require('http2');
const zlib = require('zlib');
//const URL = require('url');
const _colors = require('colors');
const fs = require('fs');

const progressbar = require('./progress-bar');
const stringbar = require('./string-bar');
const util = require('./util');

const PROTOCOL = {'http:':http, 'https:':https};
const PORTS = {'http:':'80', 'https:':'443'};

const barOptions = {
    format: '{prefix} ['+_colors.cyan('{bar}')+'] {percentage}% | ETA: {eta}s | {value}/{total} | {desc}'
};

const strBarOptions = {
    format: '{prefix} | {value} B | {desc}'
};

/*
 http request 처리
 예)
let r = new web.Request(url);
r.on('data', chunk=>{
    console.log('>>', chunk.length);
});

let r = web.RequestBar(url);

 */
function Request (url, options) {
    if('object' === typeof url) {
        options = url;
        url = undefined;
    }

    options = Object.assign({
        rejectUnauthorized:false
    }, options);

    options.headers = Object.assign({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36',
        'Cache-Control': 'no-cache',
        'pragma': 'no-cache',
        'Accept':'text/html,*/*',
        //'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Connection':'keep-alive',
        'Accept-Encoding': 'gzip, deflate, br'
        //'Accept-Encoding': 'deflate, br'
    }, options.headers);

    const self = this;

    url = url || options.url;
    const aUrl = new URL(url);
    const protocol =  PROTOCOL[aUrl.protocol];

    let ret = protocol.request( url, options);
    ret.url = url;

    ret.end();

    return ret;
}
exports = Request;

module.exports = exports;

function requestBar(request) {
    let bar = undefined;
    request.on('response', response => {
        let transEncode = response.headers['transfer-encoding'];
        if ('chunked'===transEncode) {
            bar = new stringbar(Object.assign({prefix:'FILE'}, strBarOptions));
        } else {
            let contentLength = response.headers['content-length'];
            bar = new progressbar(contentLength, Object.assign({prefix:'FILE'}, barOptions));
        }

        response.on('data', chunk => {
            if(bar) bar.update(chunk.length, {desc:request.url});
        });
    });

    return request;
}
exports.mixinBar = requestBar;

function requestEvent(request) {
    let event = new util.SingleEvent();

    request.on('response', response => {
        event.emit('begin', response);
        response.on('data', chunk => event.emit('data', chunk))
        .on('error', err => {
            event.emit('error', err);
        })
        .on('end', _=> event.emit('end'));
    }).on('abort', _=>{
        util.log('>>', 'abort');
    }).on('close', _=>{
        util.log('>>', 'close');
    }).on('error', _=>{
        util.log('>>', 'error');
    });

    return event;
}
exports.mixinEvent = requestEvent;

function requestFile(request, filename) {
    if(!filename) {
        throw 'filename is empty!!!';
        //filename = util.filenameOfUrl(request.url);
    }

    return new Promise((resolve, reject) => {
        request
        .on('response', response=>{
            let statusCode = response.statusCode;
            if(200 !== statusCode) {
                let statusMessage = response.statusMessage;
                request.abort();
                reject({statusCode, statusMessage});
                return;
            }
            let contentEncoding = response.headers['content-encoding'];
            let decoder = null;
            switch(contentEncoding) {
            case 'br': decoder = zlib.brotliDecompressSync; break;
            case 'gzip': decoder = zlib.gunzipSync; break;
            }
            let file = fs.createWriteStream(filename, {flags:'a+', encoding:null});
            response.pipe(file);
            response.on('end', _=> resolve());
        })
        .on('error', err=>{
            util.log('>> error:', err);
        });
    });
    
}
exports.mixinFile = requestFile;

function requestString(request) {
    return new Promise((resolve, reject)=>{
        let chunks = [];
        request.on('response', response=>{
            let statusCode = response.statusCode;
            if(200 !== statusCode) {
                request.abort();
                let statusMessage = response.statusMessage;
                
                switch(statusCode) {
                case 301: case 302:
                    let location = response.headers.location;
                    reject({statusCode, statusMessage, location});
                    break;
                default:
                    reject({statusCode, statusMessage});
                    break;
                }
                return;
            }

            let contentEncoding = response.headers['content-encoding'];
            let decoder = null;
            switch(contentEncoding) {
            case 'br': decoder = zlib.brotliDecompressSync; break;
            case 'gzip': decoder = zlib.gunzipSync; break;
            }
            
            response
            .on('data', chunk => {
                chunks.push(chunk);
            })
            .on('error', err => {
                reject(err);
            })
            .on('end', _=> {
                let buf = Buffer.concat(chunks);
                buf = decoder ? decoder(buf) : buf;
                let str = buf.toString('utf8');
                resolve(str);
            });
        });
    });
}
exports.mixinString = requestString;