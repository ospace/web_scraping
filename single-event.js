"use strict";

const util = require('./util');

/*
  이벤트 처리용. 단일 이벤트 리스너 처리. 이벤트는 한개씩 처리.
  function Foo() {...}
  mixin(Foo, SingleEvent);
 */
const SingleEvent = {
    on: function(id, handler) {
        if (!util.isFunc(handler)) return this;
        this.init();
        this.handlers[id] = handler;
        if (util.hasOwn(this.args, id)) {
            let args = this.args[id];
            delete this.args[id];
            handler.apply(undefined, args);
        }
        return this;
    },
    off: function (id) {
        if(!util.hasOwn(this.handlers, id)) return this;
        delete this.handler[id];
        return this;
    },
    emit: function(id, ...args) {
        if(!id) return this;
        if(util.hasOwn(this.handlers, id) && util.isFunc(this.handlers[id])) {
            let handler = this.handlers[id];
            handler.apply(undefined, args);
        } else {
            this.init();
            this.args[id] = args;
        }
        return this;
    },
    init: function() {
        if(!util.isUndef(this.handlers)) return;
        this.handlers = {};
        this.args = {};
    }
}
exports = SingleEvent;
module.exports = exports;
