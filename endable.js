const util = require('./util');
const singleevent = require('./single-event');

/*
  비동기 종료 시퀀스 처리 처리. 문제점은 asynchronous exception을 처리할 수 없음.
  이럴 경우 내부에서 catch해서 end 호출해야함.
  ex)
  new Endable((end)=>{
    console.log('>>', 'begin');
    setTimeout(()=>end(),1000);
  }).then(()=>{
    console.log('>>', 'end');
  });
 */
exports = Endable;
module.exports = exports;

function Endable(next) {
    if(!util.isFunc(next)) throw 'Enable must using function object';
    try {
        next(this.onEnd.bind(this));
    } catch(ex) {
       this.onEnd({error:ex});
    }
}

Endable.END = 'end';
util.mixin(Endable, singleevent, {
    then: function(handler) {
        this.on(Endable.END, handler);
        return this;
    },
    onEnd: function(...args) {
        this.emit(Endable.END, args);
    }
});
