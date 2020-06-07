const util = require('.//util');

/*
  이벤트 처리용. 복수 이벤트 리스너나 처리는 불가능. 같은 이벤트는 한개씩 처리.
  let events = new Eventable();
  events.on('foo', function(msg) {
      console.log('call foo:', msg);
  });
  event.emit('foo', 'hello');
 */

const Eventable = {
    on: function(id, handler, context) {
        if (!util.isFunc(handler)) return this;
        this.init();
        if(!util.hasOwn(this.handlers, id)) {
            this.handlers[id] = [];
        }
        this.handlers[id].push(handler.bind(context));
        if (util.hasOwn(this.args, id)) {
            let args = this.args[id];
            delete this.args[id];
            handler.apply(context, args);
        }
        return this;
    },
    off: function (id, handler) {
        if(!util.hasOwn(this.handlers, id)) return this;
        const idx = this.handlers[id].indexOf(handler);
        if(-1 < idx) this.handlers[id].splice(idx, 1);
        return this;
    },
    emit: function(id, ...args) {
        if(!id) return this;
        if(util.hasOwn(this.handlers, id)) {
            this.handlers[id].forEach(each=>{ each(args) });
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
exports.Eventable = Eventable;
