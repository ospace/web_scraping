'use strict';

const process = require('process');
const readline = require('readline');

class Terminal {
    constructor(stream) {
        this.stream = stream || process.stdout;
        this.cursor = 0; //current cursor
        this.lines = 0;  //total lines
    }
    
    isTTY() {
        return this.stream.isTTY == true;
    }
    
    getLines() {
        return this.lines;
    }

    saveCursor() {
        if (!this.isTTY()) return;
        this.stream.write('\x1B7');
    }

    restoreCursor() {
        if (!this.isTTY()) return;
        this.stream.write('\x1B8');
    }

    startOfLine() {
        this.cursorTo(0);
    }

    clearRight() {
        if (!this.isTTY()) return;
        readline.clearLine(this.stream, 1);
    }
    
    clearLine() {
        if (!this.isTTY()) return;
        readline.clearLine(this.stream, 0);
    }
    
    clearBottom() {
        if (!this.isTTY()) return;
        readline.clearScreenDown(this.stream);
    }

    newline() {
        this.stream.write('\n');
        ++this.lines;
        ++this.cursor;
    }
    
    setCursor(enable) {
        if (!this.isTTY()) return;
        if (enable) {
            this.stream.write('\x1B[?25h');
        } else {
            this.stream.write('\x1B[?25l');
        }
    }

    // absolate move
    cursorTo(x, y) {
        if (!this.isTTY()) return;
        this.stream.cursorTo(x, y);
    }
    
    //relative move
    moveCursor(x, y) {
        if (!this.isTTY()) return;
        readline.moveCursor(this.stream, x, y);
    }
    
    move(l) {
        if (!this.isTTY()) return;
        if (this.lines < l || 0 > l) return;
        
        let c = l - this.cursor;
        this.cursor = l;
        
        this.moveCursor(0, c);
    }

    width() {
        return this.stream.columns || (this.isTTY() ? 80 : 200);
    }
    
    height() {
        return this.stream.rows;
    }
    
    isWritable(l) {
        return (this.getLines()-this.height()) < l;
    }
    
    write(s) {
        if (!this.isTTY()) return;
        //this.stream.write(s.substr(0, this.width()+10));
        this.stream.write(s);
    }
}

exports = Terminal;
module.exports = exports;

let term = new Terminal();

exports.setCursor = function (enable) {
    term.setCursor(enable);
}

exports.newline = function () {
    term.newline();
}

exports.moveCursor = function (x, y) {
    term.moveCursor(x, y);
}

exports.write = function (s) {
    term.write(s);
}

exports.hideCursor = function () {
    term.setCursor(false);
    process.on('SIGINT', function() {
        term.setCursor(true);
        setTimeout(process.exit, 0);
    });
}

exports.isWritable = function (l) {
    return term.isWritable(l);
}

exports.move = function(line) {
    term.move(line);
}

exports.clearRight = function() {
    term.clearRight();
}

exports.startOfLine = function() {
    term.startOfLine();
}

exports.getLines = function() {
    return term.getLines();
}

exports.width = function() {
    return term.width();
}