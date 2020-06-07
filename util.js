#!/usr/bin/env node
'use strict';

const process = require('process');
const colors = require('colors');
const path = require('path');
const fs = require('fs');
//const events = require('events');
const jsonColorize = require('json-colorizer');
const printableCharacters = require ('printable-characters');
const terminal = require('./terminal');

exports.log = log;
function log(...args) {
    let buf = [];
    
    args.forEach(function(arg) {
        switch(typeof arg) {
        case 'string': buf.push(arg); break;
        case 'undefined': buf.push(colors.gray('undefined')); break;
        //case 'function': buf.push(arg.toString()); break;
        case 'function': buf.push(colors.blue(`[Funtion:${arg.name||'(anonymous)'}]`)); break;
        default: buf.push(jsonColorize(JSON.stringify(arg))); break;
        }
    });

    terminal.startOfLine();
    terminal.write(truncate(buf.join(' '), terminal.width()));
    terminal.newline();
}

exports.isUndef = isUndef;
function isUndef(obj) {
    return undefined === obj ||  null == obj;
}

exports.isFunc = isFunc;
function isFunc(obj) {
    return 'function' === typeof obj;
}

exports.eval = evalObject;
function evalObject(data) {
    return new Function('return ' + data)(); 
}

exports.getExtention = getExtention;
function getExtention (filename) {
    let idx2 = filename ? filename.lastIndexOf('.') : -1;
    if(0 > idx2) return null;
    
    let idx1 = filename.lastIndexOf('?');
    if(0 < idx1) {
        filename = filename.substring(0, idx1);
    }
    
    return filename.substring(idx2+1);	
}

/*
 URL에서 확장자 추출. 점(.)을 포함한 확장자명 반환.
 */
exports.extentionOf = extentionOf;
function extentionOf (filename) {
    if(!filename) return undefined;

    let idx;
    idx = filename.lastIndexOf('?');
    if(0 < idx) {
        filename = filename.substring(0, idx);
    }

    idx = filename.lastIndexOf('/');
    if(0  > idx) return null;
    filename = filename.substring(idx);

    idx = filename.lastIndexOf('.') ;
    if(0  > idx) return null;

    return filename.substring(idx);	
}

exports.getFilename = getFilename;
function getFilename (filename) {
    let idx2 = filename ? filename.lastIndexOf('.') : -1;
    if(0 > idx2) return null;
    return filename.substring(0, idx2);	
}

exports.filenameOfUrl = filenameOfUrl;
function filenameOfUrl (url) {
    let idx = url.lastIndexOf('?');
    if(0 < idx) {
        url = url.substring(0, idx);
    }
	return url.substring(url.lastIndexOf('/')+1);	
}

exports.filenameOf = filenameOf;
function filenameOf (url) {
    if(!url) return undefined;
    
    let idx = url.lastIndexOf('?');
    if(0 < idx) {
        url = url.substring(0, idx);
    }
    idx = url.lastIndexOf('/');
    
	return 0<idx ? url.substring(idx+1) : url;
}

exports.replaceAll = replaceAll;
function replaceAll(context, str) {
    str = str.replace(/\{(\w+)\}/g, function(match, key) {
        if(!isUndef(context[key])) { //check key
            return context[key];
        }
        return match; //no replace
    });
    return str;
}

exports.getCwd = getCwd;
function getCwd() {
	return path.basename(process.cwd());
}

exports.sleep = sleep;
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.fileSize = fileSize;
function fileSize(filename) {
    if(!filename) return -1;
    try {
        let status = fs.statSync(filename);
        return status.size;
    } catch(e) {
        return -1;
    }
}

/*
  URL에서 쿼리 스트링을 파싱
  키값 형태로 분리되며 값은 다시 디코딩해서 저장함
  또한 
 */
exports.parseQueryString = parseQueryString;
function parseQueryString(query) {
    if(!query) return null;

    var ret = {};
    query.split('&').forEach(function(it) {
        var item = it.split('=');
        ret[item[0]] = item[1] && decodeURIComponent(item[1]);
    });
    
    return ret;
}

exports.truncate = truncate;
function truncate (msg, len) {
    if (!msg) return '';
    let msgLen = printableCharacters.strlen(msg);
    return msgLen <= len ? msg : printableCharacters.first(msg, len-1) + '…';
}

exports.createFilename = createFilename;
function createFilename(url, filename) {
    if(null == filename) {
        if  ('/' == url.charAt(url.length-1)) {
            return 'index.html';
        } else {
            return filenameOfUrl(url);
        }
    } else if ('string' === typeof filename) {
        return filename;
    }
    return null;
}

/* 객체를 상속 처리. 상속은 기본적으로 부모가 하나로 제한.  그 이상인 경우는 mixin으로 해결
   ex)
   function Base() { this.id = 1 }
   function Sub() { Base.call(this) }
   // 나중에 extend를 실행하기 때문에 바로 prototype을 할당.
   Sub.prototype = { print: () { console.log('id:', this.id) }};
   extend(Sub, Base); // 나중에 호출하는게 prototype을 자동으로 넘길 수 있음.
 */
exports.extend = extend;
function extend (sub, base) {
    const Base = base;
    const Sub = sub;
    const orgProto = sub.prototype;

    Sub.prototype = Object.create(Base.prototype);
    Object.assign(Sub.prototype, orgProto);
    Sub.prototype.constructor = Sub;
    Sub.base = Base;

    return Sub;
}

/*
  다른 방식의 상속 처리. Sub 함수에서 Base 호출(Base.call(this))가 필요 없음.
  ex)
   function Base() { this.id = 1 }
   function Sub() { } // 자동으로 Base의 constructor 호출됨.
   Sub.prototype = { print: () { console.log('id:', this.id) }};
   extend(Sub, Base); // 나중에 호출하는게 prototype을 자동으로 넘길 수 있음.
 */
function extend2 (sub, base) {
    const Base = base;
    const Sub = sub;
    const orgProto = sub.prototype;

    Sub.prototype = new Base();
    Object.assign(Sub.prototype, orgProto);
    Sub.prototype.constructor = Sub;
    Sub.base = Base;

    return Sub;
}

exports.mixin = mixin;
function mixin(target, ...sources) {
    if(0 < sources.length && 'function' === typeof sources[0]) {
        sources.forEach(function(each) {
            if('function' === typeof each) each.call(target);
        });
    } else {
        Object.assign.apply(undefined, [target.prototype].concat(sources));
    }
}

exports.hasOwn = hasOwn;
const hasOwnProperty = Object.prototype.hasOwnProperty
function hasOwn (obj, key) {  
    return obj && hasOwnProperty.call(obj, key)
}

exports.cached = cached;
function cached(fn) {
    const cache = Object.create(null);
    return (function cachedFn (str) {
        const hit = cache[str];
        return hit || (cache[str] = fn(str));
    });
}

const camelizeRE = /-(\w)/g;
const camelize = cached(str => {
    return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '');
});

const capitalize = cached(str => {
    return str.charAt(0).toUpperCase() + str.slice(1);
});

const hyphenateRE = /\B([A-Z])/g
const hyphenate = cached(str => {
    return str.replace(hyphenateRE, '-$1').toLowerCase();
});

function toObject (arr) {
    const res = {};
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]) {
            Object.assign(arr[i], res);
        }
    }
    return res;
}

function once (fn) {
    let called = false;
    return function () {
        if (!called) {
        called = true;
        fn.apply(this, arguments);
        }
    }
}
