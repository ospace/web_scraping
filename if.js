const util = require('.//util');
const singleevent = require('.//single-event');

exports.If = If;
function If(next) {
    if(!util.isFunc(next)) throw 'If is must using function';
    try {
        next(this.onSuccess.bind(this), this.onFail.bind(this));
    } catch(ex) {
        this.onFail(ex);
    }
};

If.SUCCESS = 'success';
If.FAIL = 'fail';

util.mixin(If, singleevent.SingleEvent, {
    then: function(hander) {
        this.on(If.SUCCESS, hander);
        return this;
    },
    else: function(hander) {
        this.on(If.FAIL, hander);
        return this;
    },
    onSuccess: function(...args) {
        this.emit(If.SUCCESS, args);
    },
    onFail: function(...args) {
        this.emit(If.FAIL, args);
    }
});
