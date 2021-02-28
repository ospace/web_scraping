const util = require('./util');
const endable = require('./endable');

/*
   작업풀 관리
   ex)
    let workPool = new WorkPool();
    new Worker(workPool).run();

    workPool.push(Worker.newJob(end=>{
        //do something
        end();
    }));
 */
exports = WorkPool;
module.exports = exports;

function WorkPool() {
    this.jobs = [];
}

WorkPool.prototype = {
    jobs: null,
    push: function(job) { this.jobs.push(job) },
    poll: function() { return this.jobs.shift() },
    empty: function() { return 0 === this.jobs.length },
    length: function() { return this.jobs.length }
};

exports.worker = Worker;
function Worker(pool) {
    if(undefined === pool) throw "Worker must needed WorkPool: Worker(pool)";
    this.pool = pool;
}

Worker.prototype = {
    pool: null,
    status: 'stopped',
    _tick: function() {
        setTimeout(this.run.bind(this), 500);
    },
    run: function() {
        var self = this;
        self.status = 'running';
        if(self.isStop) {
            self.status = 'stopped';
            return;
        }
        
        if(self.pool.empty()) {
            self.status = 'waiting';
            return self._tick();
        }
        
        let job = self.pool.poll();
        if(!util.isFunc(job)) return self.run();
        job().then(self.run.bind(self));
    },
    stop: function() {
        this.isStop = true;
    },
    isRunning: function() {
        return 'running' === this.status;
    }
};

/* 실제 작업이 실행될 때에 Endable이 생성되어야함.
 * 그전에 생성되면 바로 Endable 실행 되버림.
 */
exports.newJob = function(job) {
    return function() {
        return new endable(job);
    };
}