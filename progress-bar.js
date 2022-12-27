"use strict";

const chalk = require("chalk");
const terminal = require("./terminal");
const util = require("./util");

class ProgressBar {
  constructor(total, opts) {
    this.total = Math.max(1, total || 20);
    this.value = 0;
    this.lines = terminal.getLines();
    this.options = Object.assign(
      {
        barsize: 20,
        format:
          "{lines} [" +
          chalk.cyan("{bar}") +
          "] {percentage}% | ETA: {eta}s | {value}/{total}",
        completeChar: "\u2588",
        incompleteChar: "\u2591",
      },
      opts
    );
    this.options.completeBar = this.options.completeChar.repeat(
      this.options.barsize
    );
    this.options.incompleteBar = this.options.incompleteChar.repeat(
      this.options.barsize
    );
    this.runtime = Date.now();
    terminal.newline();
    this.update();
  }

  drawBar(val, opts) {
    const options = this.options;
    const rate = this.value / this.total;
    const len = Math.round(options.barsize * rate);
    const duration = this.duration();
    const context = Object.assign(
      {
        lines: this.lines,
        prefix: options.prefix,
        percentage: ("" + Math.round(rate * 100)).padStart(3, " "),
        bar:
          options.completeBar.substr(0, len) +
          options.incompleteBar.substr(len, options.barsize),
        value: this.value,
        total: this.total,
        eta:
          0 == this.value
            ? "-"
            : Math.ceil((this.total / this.value) * duration - duration),
        duration: duration,
        desc: "",
      },
      opts
    );

    const s = util.replaceAll(context, options.format);
    terminal.write(util.truncate(s, terminal.width() - 1));
  }

  update(val, desc) {
    this.setValue(val, desc);

    if (!terminal.isWritable(this.lines)) return;
    let lines = terminal.getLines();
    terminal.move(this.lines);
    terminal.startOfLine();
    this.drawBar(val, desc);
    terminal.clearRight();
    terminal.move(lines);
  }

  setValue(val) {
    if (!val) return;
    this.value = Math.min(this.value + val, this.total);
  }

  increase() {
    this.draw(1);
  }

  isFin() {
    return this.total <= this.value;
  }

  duration() {
    return (Date.now() - this.runtime) / 1000.0;
  }
}

exports = ProgressBar;
module.exports = exports;
