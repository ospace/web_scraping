'use strict';

const terminal = require('./terminal');
const util = require('./util');

class StringBar {
    constructor(opts) {
        this.lines = terminal.getLines();
        this.value = 0;
        this.options = Object.assign({
            format: '{prefix} | duration: {duration}s | {value} bytes | {desc}'
        }, opts);
        this.runtime = Date.now();
        terminal.newline();
        this.update();
    }

    drawBar(val, opts) {
        const options = this.options;
        const duration = this.duration();
        const context = Object.assign({
            lines: this.lines,
            prefix: options.prefix,
            value: this.value,
            duration: duration,
            desc: ''
        }, opts);
        
        const s = util.replaceAll(context, options.format);
        terminal.write(util.truncate(s, terminal.width()-1))
    }
    
    update(val, opts) {
        this.setValue(val);
        
        if(!terminal.isWritable(this.lines)) return;
        
        terminal.move(this.lines);
        terminal.startOfLine();
        this.drawBar(val, opts);
        terminal.clearRight();
    }

    duration() {
        return (Date.now()-this.runtime)/1000.0;
    }

    setValue(val) {
        if(!val) return;
        this.value = this.value+val;
    }
}

exports = StringBar;
module.exports = exports;