
function OS() {
    OS.prototype._constructor.apply(this);
}

OS.prototype._constructor = function() {};

/*
  상속 처리. 
  ex)
   var MyCell = OS.extend();
   MyCell.prototype._constructor = function() {
       this.id = 1;
   };
 */
OS.extend = function(extendOptions) {
    const Super = this;
    const Sub = function Cell () {
        Super.apply(this, arguments);
        Sub.prototype._constructor.apply(this, arguments);
    }
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;
    /*
    Object.defineProperty(Sub.prototype, 'constructor', { 
        enumerable: false, 
        value: Sub 
    });
    */

    Sub.options = extendOptions;
    Sub['super'] = Super;
    Sub.extend = Super.extend;

    return Sub;
}